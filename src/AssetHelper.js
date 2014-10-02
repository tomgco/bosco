
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');
var mime = require('mime');
var sf = require('sf');

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
                var resolvedPath = resolve(boscoRepo, asset, assetKey);

                if (resolvedPath) {
                    newAsset.mimeType = mime.lookup(asset);
                    newAsset.assetKey = assetKey;
                    newAsset.asset = asset;
                    newAsset.repoPath = boscoRepo.repoPath;
                    newAsset.basePath = boscoRepo.basePath;
                    newAsset.relativePath = path.join(".", boscoRepo.basePath || "", asset);
                    newAsset.path = resolvedPath;
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

    }

    function createKey(tag, hash, type, extension) {
        return path.join(type, tag + (hash ? '.' + hash : '') + (extension ? '.' + extension : ''));
    }

    function checksum(str, algorithm, encoding) {
        return crypto
            .createHash(algorithm || 'md5')
            .update(str, 'utf8')
            .digest(encoding || 'hex')
    }

    function resolve(boscoRepo, asset, assetKey) {

        var resolvedPath = path.resolve(boscoRepo.path, asset);

        if (!fs.existsSync(resolvedPath)) {
            return bosco.warn(sf('Asset {asset} not found at path {path}, declared in {repo}', {
                asset: assetKey,
                path: resolvedPath,
                repo: boscoRepo.name
            }));
        };

        return resolvedPath;
    }
}
