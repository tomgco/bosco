var expect = require('expect.js');

describe('Duplicates', function() {

    it('Ignores html files even though they have matching checksums', function(done) {

        var bosco = {warn: function(message) { return true }};

        var staticAssets = {
            one: {
                assetKey: 'one',
                content: '',
                type: 'html',
                checksum: '000'
            },
            two: {
                assetKey: 'two',
                content: '',
                type: 'html',
                checksum: '000'
            },
            three: {
                assetKey: 'three',
                asset: 'a-b-c-d-e',
                content: '',
                type: 'js',
                checksum: 'yyy'
            },
            four: {
                assetKey: 'four',
                asset: 'e-f-g-h-i',
                content: '',
                type: 'js',
                checksum: 'yyy'
            }
        }

        require('../src/Duplicates')(bosco).removeDuplicates(staticAssets, next);

        function next(err, deduped) {

            expect(deduped.one.assetKey).to.equal('one');
            expect(deduped.two.assetKey).to.equal('two');
            expect(deduped.three.assetKey).to.equal('three');
            expect(deduped.four).to.be(undefined);
            done();

        };

    });

});
