
var _ = require('lodash-node');

module.exports = function(bosco) {

    return {
        removeDuplicates: removeDuplicates
    }

    function removeDuplicates(staticAssets, next) {

        var duplicates = [];

        var checkDuplicate = function(a, b) {
                var duplicate = false;
                if (a.checksum == b.checksum) {
                    if(_.contains(duplicates,b.assetKey) || _.contains(duplicates,a.assetKey)) return;
                    bosco.warn("Skipping duplicate file: " + a.assetKey + " <> " + b.assetKey);
                    duplicate = true;
                }
                return duplicate;
            },
            checkDuplicateLibrary = function(a, b) {
                var aLib = checkLibrary(a),
                    duplicate = false;
                if (aLib) {
                    var bLib = checkLibrary(b);
                    if (bLib && bLib.name == aLib.name) {
                        if(_.contains(duplicates, b.assetKey) || _.contains(duplicates, a.assetKey)) return;
                        if (bLib.version == aLib.version) {
                            bosco.warn("Duplicate library version: " + a.assetKey + " <> " + b.assetKey);
                        } else {
                            bosco.warn("Duplicate library with different version: " + a.assetKey + " <> " + b.assetKey);
                        }
                        duplicate = true;
                    }
                }
                return duplicate;
            },
            checkLibrary = function(a) {
                var dashSplit = a.asset.split("-");
                if (dashSplit[dashSplit.length - 1] == 'min.js') {
                    return {
                        version: dashSplit[dashSplit.length - 2],
                        name: dashSplit[dashSplit.length - 3]
                    };
                } else {
                    return null;
                }
            }

        _.forOwn(staticAssets, function(avalue, akey) {

            if (_.contains(['html', 'img'], avalue.type)) {
                return;
            };

            _.forOwn(staticAssets, function(bvalue, bkey) {

                if (_.contains(['html', 'img'], avalue.type)) {
                    return;
                };

                if (akey == bkey) return;
                var duplicate = checkDuplicate(avalue, bvalue);
                var duplicateLibrary = checkDuplicateLibrary(avalue, bvalue);
                if (duplicate || duplicateLibrary) {
                    console.log(avalue.assetKey, 'is a duplicate');
                    if (!_.contains(duplicates, avalue.assetKey)) {
                        duplicates.push(bvalue.assetKey);
                    }
                }
            });
        });

        // Now remove them all
        duplicates.forEach(function(key) {
            delete staticAssets[key];
        })

        next(null, staticAssets);

    }
}
