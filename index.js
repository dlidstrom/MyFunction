var async = require('async');
var gm = require('gm')
    .subClass({ imageMagick: true });
var util = require('util');
var AWS = require('aws-sdk');

var DEFAULT_MAX_WIDTH = 200;
var DEFAULT_MAX_HEIGHT = 200;
var DDB_TABLE = 'images';

var s3 = new AWS.S3();
var dynamodb = new AWS.DynamoDB();

function getImageType(key) {
    var typeMatch = key.match(/\.([^.]*)$/);
    if (!typeMatch) {
        return {
            error: `Could not determine the image type for key: ${key}`,
            imageType: null
        };
    }

    var imageType = typeMatch[1].toLowerCase();
    if (imageType != 'jpg' && imageType != 'png') {
        return {
            error: `Unsupported image type: ${imageType}`,
            imageType: null
        };
    }

    return {
        error: null,
        imageType: imageType
    };
}

exports.handler = (event, context, callback) => {
    console.log(
        "Reading options from event:\n",
        util.inspect(event, { depth: 5 }));

    var srcBucket = event.Records[0].s3.bucket.name;
    var srcKey = event.Records[0].s3.object.key;
    var dstBucket = srcBucket;
    var dstKey = `thumbs/${srcKey}`;

    var imageType = getImageType(srcKey, callback);
    if (imageType.error) {
        callback(imageType.error);
        return;
    }

    async.waterfall([
        function downloadImage(next) {
            s3.getObject(
                {
                    Bucket: srcBucket,
                    Key: srcKey
                },
                next);
        },
        function transformImage(response, next) {
            gm(response.Body).size(function (err, size) {
                var metadata = response.Metadata;
                console.log(
                    'Metadata:\n',
                    util.inspect(metadata, { depth: 5 }));

                var max_width = metadata.width || DEFAULT_MAX_WIDTH;
                var max_height = metadata.height || DEFAULT_MAX_HEIGHT;

                var scalingFactor = Math.min(
                    max_width / size.width,
                    max_height / size.height);

                var width = scalingFactor * size.width;
                var height = scalingFactor * size.height;

                this.resize(width, height)
                    .toBuffer(imageType.imageType, function (err, buffer) {
                        if (err) {
                            next(err);
                        } else {
                            next(null, response.ContentType, metadata, buffer);
                        }
                    });
            });
        },
        function uploadThumbnail(contentType, metadata, data, next) {
            // stream the transformed image to a different s3 bucket
            s3.putObject(
                {
                    Bucket: dstBucket,
                    Key: dstKey,
                    Body: data,
                    ContentType: contentType,
                    Metadata: metadata
                },
                function (err, buffer) {
                    if (err) {
                        next(err);
                    } else {
                        next(null, metadata);
                    }
                });
        },
        function storeMetadata(metadata, next) {
            // adds metadata to DynamoDB
            var params = {
                TableName: DDB_TABLE,
                Item: {
                    name: { S: srcKey },
                    thumbnail: { S: dstKey },
                    timestamp: { S: new Date().toJSON() }
                }
            };

            if ('author' in metadata) {
                params.Item.author = { S: metadata.author };
            }

            if ('title' in metadata) {
                params.Item.title = { S: metadata.title };
            }

            if ('description' in metadata) {
                params.Item.description = { S: metadata.description };
            }

            dynamodb.putItem(params, next);
        }
    ],
    function (err) {
        if (err) {
            console.error(err);
        } else {
            console.log(`Successfullyy resized ${srcBucket}/${srcKey} and uploaded to ${dstBucket}/${dstKey}`);
        }

        callback();
    });
};
