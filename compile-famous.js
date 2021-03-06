
var fs = Npm.require('fs');
var path = Npm.require('path');
var exec = Npm.require('sync-exec');

var red = '\u001b[31m';
var green = '\u001b[32m';
var gray = '\u001b[2m';
var white = '\u001b[1m';
var normal = '\u001b[0m';

// Changing this will force a rerun of deps - this makes it easier for the users
var version = '0.0.22';

// Set the main famono folder for our work...
var famonoRepoFolder = path.join(process.cwd(), '.meteor', '.famono-repos');
// Make sure famonoRepoFolder exists
if (!fs.existsSync(famonoRepoFolder)) fs.mkdirSync(famonoRepoFolder);

// Make sure we can work here...
if (!fs.existsSync(famonoRepoFolder))
  throw new Error('Famono cannot create any files - make sure you have the necessary rights to the filesystem');

var configFolder = path.join(famonoRepoFolder, '.config');
var famonoLibFolder = path.join(famonoRepoFolder, 'lib');

// Make sure famonoLibFolder exists
if (!fs.existsSync(famonoLibFolder)) fs.mkdirSync(famonoLibFolder);

var versionFile = path.join(famonoLibFolder, '.version');

var installationNote = function() {
  console.log('');
  console.log('', white);
  console.log('F A M O N O', green);
  console.log('-----------', normal);
  console.log('The Famono package will rig the Famo.us package system into Meteor.js');
  console.log('package system');
  console.log('');
  console.log('It adds the global "require" on the client');
  console.log('It will rig dependencies on the client using "define"');
  console.log('');
  console.log('It also parses your source code when you change it, and figure');
  console.log('out what libraries must be bundled for the client.');
  console.log('');
  console.log('You can add/remove libraries to the "lib/smart.require" and will');
  console.log('download and keep the libraries updated via github.');
  console.log('');
  console.log('NOTE: Famono depends on', white, 'git!!', normal);
  console.log('');
  console.log('Kind regards Morten (aka raix)', green);
  console.log('-----------', normal);
};

var installationGitIgnore = function() {
  var gitignoreFolder = path.join(process.cwd(), '.meteor', '.gitignore');
  var contents = '';
  try {
    contents = fs.readFileSync(gitignoreFolder, 'utf8');
  } catch(err) {
    // Prop. not found...
  }
  // Remove the .famono-repos
  contents = contents.replace('.famono-repos\n', '');
  // Add the .famono-repos
  contents += '.famono-repos\n';
  // Write the file again...
  fs.writeFileSync(gitignoreFolder, contents, 'utf8');  
};

var installationCheck = function() {

  // library folder to ensure load order
  var libFolder = path.join(process.cwd(), 'lib');
  // The filename of the smart.require
  var filename = path.join(libFolder, 'smart.require');
  
  if (!fs.existsSync(libFolder))
    fs.mkdirSync(libFolder);

  if (!fs.existsSync(filename)) {
    installationNote();
    // Add to ignore
    installationGitIgnore();
    // Prepare the user and system on how this is going down...
    console.log(green, 'Famono:', normal, 'Creating "lib/smart.require" config file, for you to edit');

    var defaultDeps = JSON.stringify({
      'famous': {
        git: 'https://github.com/Famous/famous.git'
      },
      'famous-polyfills': {
        git: 'https://github.com/Famous/polyfills.git'
      }
    }, null, '\t');

    fs.writeFileSync(filename, defaultDeps, 'utf8');

    
  }
  
};

var namespaceErrors = {};
var namespaceError  = function(name, filename) {
  if (!namespaceErrors[name]) {

    console.log(green, 'Famono:', normal, 'Error, could not load library namespace "' + name + '" file:', filename);
    // Hinder more errors on the namespace...
    namespaceErrors[name] = true;

  }
};

var libraryErrors = {};
var libraryError = function(name, lookup, filename) {
  if (!libraryErrors[name]) {

    console.log(green, 'Famono:', normal, 'Error, could not load library "' + name + '" file:', filename);

    if (!lookup[name]) {
      var found;
      for (var key in lookup)
        if (name.toLowerCase() == key.toLowerCase()) found = { key: key, name: name};

      if (found)
        console.log(green, 'Famono:', normal, 'Did you mean "' + found.key + '" instead of "' + found.name + '"?');
    } else {
      // Some other error
    }
    // Hinder more errors on the namespace...
    libraryErrors[name] = true;

  }
};
/**
 * @method eachFile
 * @param {Function} f callback(filename, name, level, index)
 * @returns {Array} list of javascript filenames in the bundle
 */
var eachFile = function(folder, f, dotted, level) {
  var fileList = fs.readdirSync(folder);
  // Make sure we have a proper level
  level = level || 0;

  for (var i = 0; i < fileList.length; i++) {
    // Keep nice reference to the filename
    var name = fileList[i];
    // Split the file name by '.'
    var sn = name.split('.');
    // Get the full filename
    var filename = path.join(folder, name);
    // Set dotted
    var isDotted = (sn[0] === '');
    // Get the file stats
    var stats = fs.statSync(filename);
    // Show this dotted, if dotted is true we dig into dotted folders
    var showDotted = (dotted === true && isDotted) || (!isDotted);
    // We only iterate over non-dotted javascript files - this should be
    // recursive, avoiding private, public and server folders
    if (stats.isFile())
      f({
        folder: folder,
        filename: filename,
        name: name,
        level: level,
        index: i,
        ext: sn[sn.length-1].toLowerCase(),
        isDotted: isDotted,
      });
    // If we are dealing with a sub folder then chek that we are not in a server
    // folder - we dont care about the server side, public or private code at
    // all here...
    // Meteor only cares about top level folders so we allow all names at
    // greater levels than 0
    if (showDotted && stats.isDirectory())
      eachFile(filename, f, dotted, level + 1);
  }
};

/**
 * @objectMerge
 * @params {Objects} arg0 .. argn Objects to merge
 */
 var objectMerge = function(/* object1 .. objectN */) {
  var result = {};
  for (var i = 0; i < arguments.length; i++) {
    // Get the current object
    var o = arguments[i];
    // Iterate over keys
    for (var key in o) {
      // Set the key and value in the result object
      result[key] = o[key];
    }
  }
  // Return the merged object
  return result;
 }

/**
  * @method removeFolder
  * @param {String} pathName
  */
var removeFolder = function(pathName) {
  // Get the list of files
  try {
    var fileList = fs.readdirSync(pathName);
    // Empty the folder first
    for (var i = 0; i < fileList.length; i++) {
      // Filename
      var filename = fileList[i];
      // path name
      var filePath = path.join(pathName, filename);
      // Get the stats
      var stats = fs.statSync(filePath);
      // Check if we got a folder
      if (stats.isDirectory()) {
        // Remove folders recursive
        removeFolder(filePath);
      } else {
        // Remove files
        fs.unlinkSync(filePath);
      }
    }
    // Remove the empty folder
    fs.rmdirSync(pathName);
  } catch(err) {
    // Nothing - we dont have a folder to remove
  }
};

var ensureFolder = function(folder) {
  // Get the folderList
  var folderList = folder.split(path.sep);
  folderList.shift();
  // Init pathname
  var pathName = '';
  for (var i = 0; i < folderList.length; i++) {
    pathName += path.sep + folderList[i];
    // Check if the path exists, if not the create the folder
    if (!fs.existsSync(pathName))
      fs.mkdirSync(pathName);
  }
};

var resolveDepPath = function(currentPath, depPath) {
  var resolved = path.resolve(currentPath, depPath).substring(1);
  // Sometimes people put extensions in here too - we will remove it if js or css
  var list = resolved.split('.');
  // Check if the last segment is js or css
  if (/^js$|^css$/.test(list[list.length-1])) list.pop();
  // Join the list into the resolved again
  resolved = list.join('.');
  // Return the resolved dep path
  return resolved;
};

var isStringMode = function(mode) {
  return (mode === 'single-string' || mode === 'double-string');
};

/**
 * @method parseCode
 * @param {string} code Tha code to modify and scan for deps
 * @returns {Object} { code:'', deps: [] }
 */
var parseCode = function(currentDep, code) {
//console.log(code);
  var validChars = '_.$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  var validCharsLookup = {};
  var t = '';
  var m = '';
  // Create index
  for (var a = 0; a < validChars.length; a++) validCharsLookup[validChars[a]] = a;

  var mode = 'code';
  var lastMode = mode;

  var lastCharMode = mode;
  var charMode = mode;

  var escape = false;
  var lastEscape = false;
  var currentWord = '';
  var append = '';
  var foundDefine = false;
  var debug = 0;

  // Get the base name
  var currentBasename = path.basename(currentDep, '.js');
  // Cut off the file name
  var currentDepPath = path.join(path.sep, path.dirname(currentDep));
  // Get current dep name
  var currentDepName = path.join(currentDepPath, currentBasename).substring(1);
  // Set the define reference
  var defineReference = '\'' + currentDepName + '\', ';
  // Set the define statement string
  var defineStatement = 'define(' + defineReference;  
  // Init result
  var result = {
    code: '',
    current: currentDepName,
    deps: []
  };
  // Log words and their mode 
  var words = [];

  // Byte parser
  for (var i = 0; i < code.length; i++) {
    // Current char
    var c = code[i];
    // Prev char
    var cp = code[i-1];
    // Next char
    var cn = code[i+1];

    // Check previous char
    escape = (cp === '\\') && !lastEscape;


    // Mode setters and unsetters
    if (mode !== 'code') {
      if (mode === 'block-comment' && c == '*' && cn == '/') mode = 'code';
      if (mode === 'line-comment' && c == '\n') mode = 'code';
      if (mode === 'double-string' && c == '"' && !escape) mode = 'code';
      if (mode === 'single-string' && c == "'" && !escape) mode = 'code';
    } else {
      if (c == '/' && !escape && cn == '*') mode = 'block-comment';
      if (c == '/' && !escape && cn == '/') mode = 'line-comment';
      if (c == '"' && !escape) mode = 'double-string';
      if (c == "'" && !escape) mode = 'single-string';
    }

    if (c === '\n') {
      // (debug === 1) && console.log(t);
      // (debug === 1) && console.log(m);
      t = '';
      m = '';
    } else {
      t += c;
      if (escape) {
        m += 'E';
      } else {
        if (!isStringMode(lastMode) && isStringMode(mode)) {
          charMode = lastMode;
        } else {
          charMode = mode;          
        }
        m += charMode[0];
      }
    }



    // Check if the char is valid or if in string mode
    if (validCharsLookup[c] || isStringMode(charMode)) {

      lastCharMode = charMode;
      currentWord += c;
     
    } else {
      // If we got an actual word we store this
      if (currentWord !== '') {

        words.push({
          mode: lastCharMode,
          text: currentWord,
          end: i
        });
        // Get the last and current words...
        var last = words[words.length-2] || {};
        var current = words[words.length-1];

        // if (debug === 2) {
        //   if (last.text === 'require') {
        //     var t = '';
        //     for (var a = 1; a < 10; a++)
        //       t = words[words.length - a].text + ' ' + t;
        //     var m = '';
        //     for (var a = 1; a < 10; a++)
        //       m = words[words.length - a].mode + ' ' + m;
        //     console.log(t);
        //     console.log(m);
        //     console.log(last, current);
        //     console.log('-------');
        //   }  
        // }


        // Find require()
        if (last.mode === 'code' && last.text === 'require' &&
                (current.mode === 'single-string' ||
                 current.mode === 'double-string')) {

          if (current.text[0] == '.') {

            // Resolve dependency
            // Correct the dependency by removing the current word from the
            // code buffer and insert the resolved dep name instead
            var resolveDepName = resolveDepPath(currentDepPath, current.text);
            // First char to overwrite
            var newLength = result.code.length - current.text.length;
            // Remove the origibal reference
            result.code = result.code.substring(0, newLength);
            // Add the full reference
            result.code += resolveDepName;

            //console.log(mode, currentDepPath, current.text, resolveDepName);
            result.deps.push(resolveDepName);
            
            //console.log(resolveDepName);
          } else {
            // Do nothing to resolve - trust the user?
            result.deps.push(current.text);
            //console.log(current.text);
          }

        }

        // Find define()
        if (last.mode === 'code' && last.text === 'define') {         

          if (current.mode === 'code' && current.text === 'function') {
            // We got define(function...
            var rest = result.code.slice(last.end + 1);
            result.code = result.code.substring(0, last.end + 1) + defineReference + rest;
            foundDefine = true;
          }

        }

      }
      // Reset the current word
      currentWord = '';
    }

    // add code
    result.code += c + append;
    // Reset append
    append = '';
    // Set carry for last mode
    lastMode = mode;
    // remember the last escape
    lastEscape = escape;

  }

  // if (debug === 3) {
  //   mode = 'code';
  //   text = '';
  //   for (var i = 0; i < words.length; i++) {
  //     var word = words[i];
  //     if (word.mode === mode) {
  //       text += ' ' + word.text;
  //     } else {
  //       console.log(green, mode, normal, text);
  //       mode = word.mode;
  //       text = word.text;
  //     }
  //   }
  // }

  // Add deps...
  var depsString = JSON.stringify(result.deps);

  // If no define is set then assume that we have unwrapped code
  if (foundDefine) {
    // Update the code inserting the deps list
    result.code = result.code.replace(defineStatement, defineStatement + depsString + ', ');
  } else {
    // Wrap in module
    result.code = defineStatement + depsString + ', function(require, exports, module) {\n' + result.code + '\n});';
  }



  // Return the result object
  return result;
};

/**
 * @method updateDependencies
 * @param {string} name Dependency name
 * @param {string} repoPath path of the repo
 */
var updateDependencies = function(name) {
  // Set repo path
  var repoPath = path.join(famonoRepoFolder, name);  
  // Set repo path
  var libPath = path.join(famonoLibFolder, name);  
  // Set deps path
  var depsPath = path.join(famonoRepoFolder, '.' + name);
  // Init deps object       
  var deps = {};
  // Remove the deps in lib
  removeFolder(libPath);
  // Iterate over the files
  eachFile(repoPath, function(file) {
    if (file.ext === 'js' || file.ext === 'css') {
      // Remove the famonoRepoFolder part from the filenames
      var depName = file.filename.substring(famonoRepoFolder.length + 1);

      // Set empty result
      var result = {};

      // Check if we are handling js or css
      if (file.ext === 'js') {

        // Parse and correct the code
        result = parseCode(depName, fs.readFileSync(file.filename, 'utf8'));
        // Set deps relations
        deps[result.current] = result.deps;
        
      } else {

        // Get the base name
        var currentBasename = path.basename(depName, '.css');
        // Cut off the file name
        var currentDepPath = path.join(path.sep, path.dirname(depName));
        // Get current dep name
        var currentDepName = path.join(currentDepPath, currentBasename).substring(1);

        // Just load the code
        var result = {
          code: fs.readFileSync(file.filename, 'utf8'),
          current: currentDepName
        };
        // Set deps relations
        // Css dont have any relations but we set the deps if not set
        // We could have a situation where only the css file is present so
        // we deal with that. This is a weak set of the deps, they will be
        // overwritten by js deps if found.
        if (!deps[result.current]) deps[result.current] = [];

      }

      // Create the paths
      var filename = path.join(famonoLibFolder, depName);
      var dirname = path.dirname(filename);
      // Store the modifyed code to the famonoLibFolder
      // 1. create the base folder
      //console.log('ensureFolder', dirname);
      ensureFolder(dirname);
      // 2. store code into file
      //console.log('fileName', filename);
      fs.writeFileSync(filename, result.code, 'utf8');

    }

  });
  // Write the package deps
  fs.writeFileSync(depsPath, JSON.stringify(deps, null, '\t'), 'utf8');
};

var removeRepoFolder = function(name, keepRepo) {
  // Make sure we have a name set
  if (!name) return;
  // Set the repo path
  var repoPath = path.join(famonoRepoFolder, name);
  // Set the lib path
  var libPath = path.join(famonoLibFolder, name);
  // Set the deps folder
  var depsPath = path.join(famonoRepoFolder, '.' + name);

  if (!keepRepo) removeFolder(repoPath);
  removeFolder(libPath);
  try {
    fs.unlinkSync(depsPath);
  } catch(err) {
    // Do nothing
  }
};

/**
 * @method checkGitFolders
 * @param {Object} config Configuration to match
 * @param {Object} oldConfig Configuration to check up on
 *
 */
var checkGitFolders = function(newConfig, oldConfig) {
  // Create one united config
  var config = objectMerge(oldConfig, newConfig);
  // Iterate over the deps
  for (var name in config) {
    // Set item helper
    var item = config[name];
    // Set repo path
    var repoPath = path.join(famonoRepoFolder, name);
    // Check if we have a repo
    if (item.git) {
      // Check if the git is different
      if (newConfig[name] && oldConfig[name] && newConfig[name].git !== oldConfig[name].git) {
        // The repo has changed - so remove the repo folder
        console.log(green, 'Famono:', normal, 'The new repo has changed for "' + name + '"', repoPath);
        // Remove the repo path
        removeRepoFolder(name);
      }
      // Check if the repo is found
      if (fs.existsSync(repoPath)) {
        // Check if the dep is found in the new config
        if (newConfig[name]) {

          // Do a git update
          // XXX: We dont update the repo - if users wants this, they should
          // set tag/branch etc.
          //
          var result = exec('git pull', { cwd: repoPath });
          if (result.status == 0) {
            if (result.stdout !== 'Already up-to-date.\n') {
              console.log(green, 'Famono:', normal, 'updating dependencies "' + name + '" ');          
              updateDependencies(name);
            } else {
              console.log(green, 'Famono:', normal, 'git update "' + name + '" is up-to-date');
            }

            // Remove but keep the repo
            removeRepoFolder(name, true);
            // Update the deps
            updateDependencies(name);

          } else {
            console.log(green, 'Famono:', normal, 'git update "' + name + '" ' + repoPath, ' Error!!');
          }
          //console.log(name, status);          
        } else {
          // Its not in the new repo so we remove it...
          console.log(green, 'Famono:', normal, 'remove dep "' + name + '" ' + repoPath);
          removeRepoFolder(name);
        }

      } else {
        // So the repo is not found then check if its in the new config
        if (newConfig[name]) {
          // We have to create the folder then
          fs.mkdirSync(repoPath);
          // Guess so then clone the repo to the repo folder
          console.log(green, 'Famono:', normal, 'downloading "' + item.git + '"');
          // Set git params
          var gitParams = [];
          // Set the base command
          gitParams.push('git clone');
          // Set the git reference
          gitParams.push(item.git);
          // Set the target path
          gitParams.push(repoPath);
          // We dive into submodules
          if (item.recursive !== false) gitParams.push('--recursive');
          // Set the branch but make sure that the user havent set tag already
          // tags overrule the branch in Famono...
          if (item.branch && !item.tag) gitParams.push('--branch ' + item.branch);
          // Set the branch
          if (item.tag) gitParams.push('--branch tags/' + item.tag);

          // Clone the repo
          var result = exec(gitParams.join(' '));
          // Check if we have exited correctly
          if (result.status !== 0) {
            // Remove the folder
            removeRepoFolder(name);
            // Throw an error
            throw new Error('Famono: Error could not clone "' + name + '" ' + item.git + ': ' + result.stderr);
          } else {
            console.log(green, 'Famono:', normal, 'Scan the folder and create a dependency file for the repo');

            updateDependencies(name);
          }
        } 
      }
    } else {
      console.error('Famono could not find repo for "' + name + '", please set "git"');
    }
  }
};


var ensureDependencies = function(compileStep) {
  // We only want to deal with one require file at this moment... and it has to
  // be located in the lib folder.
  if (compileStep.inputPath !== 'lib/smart.require')
    return;

  // Read in the require files
  var requireFile = compileStep.read().toString('utf8');
  var lastRequireFile = (fs.existsSync(configFolder)) ? fs.readFileSync(configFolder, 'utf8') : '{}';

  // Check the version and the versionFile to see if we have changed api
  // and need to recreate libs etc.
  var lastVersion = (fs.existsSync(versionFile)) ? fs.readFileSync(versionFile, 'utf8') : '';

  // We only want to handle if the config has actually changed
  if (lastRequireFile !== requireFile || lastVersion !== version) {

    var newConfig, oldConfig;

    try {
      newConfig = JSON.parse(requireFile);
    } catch(err) {
      console.log(green, 'Famono:', normal, 'You have an error in your "lib/smart.require"');
      console.log(red, 'Error:', normal, err.message);
      throw new Error('Famono: could not parse "lib/smart.require"');
    }

    try {
      oldConfig = JSON.parse(lastRequireFile);
    } catch(err) {
      // We reset if theres an error on the old config...
      // XXX: we should clean out the folder
      oldConfig = '{}';
    }

    //console.log('CHECK REPO FOLDER');
    // Make sure the repo is up to date
    checkGitFolders(newConfig, oldConfig);
    // Update the last config
    fs.writeFileSync(configFolder, requireFile, 'utf8');
    // Update the version file
    fs.writeFileSync(versionFile, version, 'utf8');

  } else {
    // console.log('CONFIG NOT CHANGED');
  }

};

// Scan the users source code for dependencies...
var sourceCodeDependencies = function() {
  // Source deps
  var sourceDeps = {};
  // Get the main code folder
  var codeFolder = process.cwd();
  // Scan the source files to find the dependency list
  eachFile(codeFolder, function(file) {
    // Get the folder
    var folder = file.filename.substring(codeFolder.length);

    // We dont care about public, private, server or package root folders
    // And we want javascript files and they may not be prefixed dotted
    if (!/^\/public\/|^\/private\/|^\/server\//.test(folder) &&
            /^js$|^coffee$|^litcoffee$|^coffee.md$/.test(file.ext) &&
            !file.isDotted) {
        // Load the code
        var code = fs.readFileSync(file.filename, 'utf8');
        // Parse the file
        var result = parseCode(folder, code);
        // Store the source dependencies
        sourceDeps[folder] = result.deps;
    }

  });

  return sourceDeps;  
};

var getDepRoot = function(depName, last) {
  var list = depName.split('/');
  var index = (last) ? list.length - 1 : 0;
  return list[index];
};

var eachSourceDeps = function(sourceDeps, f) {
  // Iterate over the files
  for (var file in sourceDeps) {
    // Get the deps in the file
    var deps = sourceDeps[file];
    // Iterate over each dep in file
    for (var i = 0; i < deps.length; i++) {
      // Get the dep name
      var depName = deps[i];
      f({
        filename: file,
        name: depName,
        root: getDepRoot(depName),
      });
    }
  }
};

var loadDependenciesRegisters = function(sourceDeps, libraries) {
  var result = {};

  eachSourceDeps(sourceDeps, function(dep) {

    if (typeof result[dep.root] === 'undefined') {

      var filename = path.join(famonoRepoFolder, '.' + dep.root);

      try {
        result[dep.root] = JSON.parse(fs.readFileSync(filename, 'utf8'));
      } catch(err) {
        namespaceError(dep.root, dep.filename);
      }
      
    }

  });

  return result;
};

var neededDeps = {};
var neededDepsIndex = 0;
var loadDepsList = [];

var resolveDependencies = function(filename, wanted, libraryDeps, level) {
  level = level || 0;
  // We check wanted
  // wanted = ['dep1', 'dep2']
  for (var i = 0; i < wanted.length; i++) {
    var name = wanted[i];

    if (typeof neededDeps[name] === 'undefined') {
      // Get the lib root
      var root = getDepRoot(name);
      var suffix = getDepRoot(name, true);


      if (libraryDeps[root]) {

        // Check if we are actually pointing to a folder? if it contains an
        // index file then use that instead
        if (libraryDeps[root][name + '/index']) {
          name += '/index';
        } else if (libraryDeps[root][name + '/' + suffix]) {
         name += '/' + suffix;
        }



        // Still make sure the library is found
        if (libraryDeps[root][name]) {

          // Get the nested deps
          var nextWanted = libraryDeps[root][name];
          // Add the dep and resolve its deps
          neededDeps[name] = level;
          // Resolve the deps
          resolveDependencies(filename, nextWanted, libraryDeps, level+1);
          // Add the deps to the load list
          loadDepsList.push({ 
            name: name,
            level: level,
            index: neededDepsIndex++,
            deps: nextWanted.length
          });

        } else {
          // Add the deps to the load list - Note, we cant find it - but
          // we dont want to upset the client because of our limitations
          // it could be that the code uses eg. require('name' + foo); this
          // cannot be resolved by us - the client may know more than we...
          loadDepsList.push({ 
            name: name,
            level: level,
            index: neededDepsIndex++,
            deps: 0
          });   
          // And we warn about an error...       
          libraryError(name, libraryDeps[root], filename);
        }
        
      } else {
        namespaceError(root, filename);
      }
    }

  }
};


// Make sure the system is rigged
installationCheck();

Plugin.registerSourceHandler("require", function (compileStep) {
  compileStep.rootOutputPath = '/lib/';
  // We only care about generating client-side code...
  if (compileStep.arch !== 'browser')
    return;

  console.log('\nEnsure dependencies...');
  // We check if the config has changes and load / unload dependencies
  // accordingly          
  ensureDependencies(compileStep);

  // Scan the user code for require statements...
  var sourceDeps = sourceCodeDependencies();

// console.log(sourceDeps);

  // Load libraries registers
  var libraryDeps = loadDependenciesRegisters(sourceDeps);

//console.log(libraryDeps);

  // Load needed deps list
  for (var file in sourceDeps) {
    // Get the deps pr. file
    var deps = sourceDeps[file];
    // Resolve the files
    resolveDependencies(file, deps, libraryDeps);
  }

  // Make sure we only serve the dependencies once...
  var isShipped = {};
  // Count the defines
  var sumOfDefines = 0;

  // Add the library javascript
  for (var i = 0; i < loadDepsList.length; i++) {
    var dep = loadDepsList[i];

    if (!isShipped[dep.name]) {
      // Make sure we only serve things once
      isShipped[dep.name] = true;
      // Inc counter
      sumOfDefines++;

      // ADD JS
      var filenameJS = path.join(famonoLibFolder, dep.name + '.js');

      // Check if the ressource is found
      if (fs.existsSync(filenameJS)) {

        compileStep.addJavaScript({
          path: 'lib/' + dep.name + '.js',
          sourcePath: 'lib/' + dep.name + '.js',//filenameJS,
          data: fs.readFileSync(filenameJS, 'utf8'),
          bare: true
        });

      } else {
        // Add definition - we prop. only got a css file or something
        compileStep.addJavaScript({
          path: 'lib/' + dep.name + '.js',
          sourcePath: 'lib/' + dep.name + '.js',//filenameJS,
          data: 'define(\'' + dep.name + '\', [], function() {});',
          bare: true
        });      
      }

      // ADD CSS
      var filenameCSS = path.join(famonoLibFolder, dep.name + '.css');
      // Check if the ressource is found
      if (fs.existsSync(filenameCSS)) {

        compileStep.addStylesheet({
          path: 'lib/' + dep.name + '.css',
          data: fs.readFileSync(filenameCSS, 'utf8'),
          //sourceMap: 
        });
        
      }

    }


  }

  // We set the count of defines and check load
  //compileStep.appendDocument({ section: "body", data: '<script>\n  define(' + sumOfDefines + ');\n</script>\n' });

// console.log(loadDepsList);

});