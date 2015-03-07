var gulp = require('gulp');
var markedMan = require('gulp-marked-man');
var mocha = require('gulp-mocha');
var fs = require('fs');

gulp.task('default', function() {

    fs.readdir('./help', function(err, files) {
        files.forEach(function(file) {
            gulp.src('./help/' + file)
                .pipe(markedMan())
                .pipe(gulp.dest('./man/man3'));
        });
    });

});

gulp.task('test', function () {
    return gulp.src('test/*.test.js', {read: false})
        .pipe(mocha({reporter: 'nyan'}));
});
