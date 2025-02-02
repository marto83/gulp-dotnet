'use strict';

var gutil = require('gulp-util');
var proc = require('child_process');
var notifier = require('node-notifier');

const logLevels = {
  DEBUG: 1,
  INFO: 2,
  ERROR: 3,
  SILENT: 4
};

const defaults = {
  
  // working directory
  cwd: './',
  
  // how noisy?
  logLevel: logLevels.DEBUG,
  
  // default task to launch
  // not hooked up atm
  task: 'web',
  
  // notify on errors
  notify: true
  
};

function assignDefaults(opts){
  opts = opts || {};
  // could be remove if Node supported
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
    for(let opt in defaults){
    if(!opts.hasOwnProperty(opt)){
      opts[opt] = defaults[opt];
    }
  }
  return opts;
}

class Dotnet {
  
  static start(task, opts, cb){
    opts = assignDefaults(opts);
    return new Dotnet(opts).start(task, cb);
  }
  
  static build(opts, cb){
    opts = assignDefaults(opts);
    return new Dotnet(opts).build(cb);
  }
  
  static update(opts, cb){
    opts = assignDefaults(opts);
    return new Dotnet(opts).update(cb);
  }

  constructor(opts){
    this.options = assignDefaults(opts);
  }
  
  log(level, msg, data){
    if(level <= this.options.logLevel){
      let color = level === logLevels.ERROR ?
        gutil.colors.red : gutil.colors.blue;
        
      msg = `${ color('DOTNET') }: ${msg}`;
      
      if(data)  { 
        gutil.log(msg, data);
      } else {
       gutil.log(msg);
      }
    } 
  }
  
  notify(msg){
    if(this.options.notify){
      notifier.notify({
        sound: true,
        message: 'DOTNET Notification',
        title: msg
      });
    }
  }
  
  start(task, done){
    // only do first time
    if(!this.child){
      process.on('exit', () => this.kill());
    }
    
    if (this.child) {
      this.log(logLevels.INFO, 'Restarting');
      this.kill();
    }
    
    if(this.starting) {
      this.log(logLevels.ERROR, 'Tried to start multiple instances while still starting!');
      this.notify('Tried to start multiple instances while still starting!');
      return;
    }
      
    this.starting = true;
    this.child = proc.spawn('dotnet', [task], {
      cwd: this.options.cwd,
      detached: true
    });
    
    this.child.stdout.on('data', (data) => {
        this.log(logLevels.DEBUG, data);
        
        // kinda hacky but want to know when this started to call done() for gulp
        if(!this.started && data.indexOf('Application started') > -1){
          this.log(logLevels.INFO, data);
          this.starting = false;
          this.started = true;
          done && done();
        }
    });

    this.child.stderr.on('data', (data) => {
      this.log(logLevels.ERROR, data);
      this.starting = false;
    });

    this.child.on('close', (code) => {
      if (code === 8) {
        this.log(logLevels.ERROR, `Error Ocurred!`);
        this.notify('Error Ocurred!');
      } else {
        this.log(logLevels.DEBUG, ` Exiting...`);
      }
      
      this.started = false;
      this.starting = false;
    });
  }
  
  kill(){
    if (this.child) {
      this.started = false;
      this.starting = false;
      process.kill(-this.child.pid);
    }
  }
  
  build(done){
    proc.exec('dotnet build', {
      cwd: this.options.cwd 
    }, (err, stdout, stderr) => {
      if (err) {
        this.log(logLevels.ERROR, `Build Failed`, err);
        this.notify('Build Failed');
        done && done(err);
      } else {
        this.log(logLevels.DEBUG, stdout);
        done && done();
      }
    });
  }

  test(done){
    proc.exec('dotnet test', {
      cwd: this.options.cwd 
    }, (err, stdout, stderr) => {
      if (err) {
        this.log(logLevels.ERROR, `Test Error`, err);
        this.notify('Test Failed');
        done && done(err);
      } else {
        this.log(logLevels.DEBUG, stdout);
        done && done();
      }
    });
  }
  
  update(done){
    proc.exec('dotnet restore', {
      cwd: this.options.cwd 
    }, (err, stdout, stderr) => {
      if (err) {
        this.log(logLevels.ERROR, `Restore Error`, err);
        this.notify('Restore Failed');
        done && done(err);
      } else {
        this.log(logLevels.DEBUG, stdout);
        done && done();
      }
    });
  }
  
}

module.exports = Dotnet;
