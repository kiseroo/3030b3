module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    require: ['features/step_definitions/**/*.js'],
    format: ['progress-bar', 'html:cucumber-report.html'],
    publishQuiet: true
  }
}; 