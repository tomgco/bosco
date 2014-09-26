
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');
var mime = require('mime');

module.exports = function(bosco) {

    return {
        getAssetHelper: getAssetHelper,
        createKey: createKey,
        checksum: checksum
    }

    function getAssetHelper(boscoRepo, tagFilter) {
        var repoAssetPath = boscoRepo.basePath || '.';

        return {
            addAsset: function(staticAssets, assetKey, asset, tag, type) {

                if (tagFilter && tag !== tagFilter) return;

                var newAsset = {};

                newAsset.mimeType = mime.lookup(asset);
                newAsset.assetKey = assetKey;
                newAsset.asset = asset;
                newAsset.repoPath = boscoRepo.repoPath;
                newAsset.basePath = boscoRepo.basePath;
                newAsset.relativePath = path.join(".", path.relative(repoAssetPath, asset));
                newAsset.path = path.resolve(boscoRepo.path, asset);
                newAsset.extname = path.extname(asset);
                newAsset.tag = tag;
                newAsset.repo = boscoRepo.name;
                newAsset.type = type;
                newAsset.data = fs.readFileSync(newAsset.path);
                newAsset.content = newAsset.data.toString();
                newAsset.checksum = checksum(newAsset.content, 'sha1', 'hex');

                staticAssets[assetKey] = newAsset;

            }

        }

    }

    function createKey(tag, hash, type, extension) {
        return bosco.options.environment + '/' + (bosco.options.build ? bosco.options.build + '/' : '') + type + '/' + tag + (hash ? '.' + hash : '') + (extension ? '.' + extension : '');
    }

    function checksum(str, algorithm, encoding) {
        return crypto
            .createHash(algorithm || 'md5')
            .update(str, 'utf8')
            .digest(encoding || 'hex')
    }
}
