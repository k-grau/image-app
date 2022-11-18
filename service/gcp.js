const analyzeImage = async (filePath) => {
    const vision = require('@google-cloud/vision');
    const client = new vision.ImageAnnotatorClient();

    // Performs label detection on the image file
    const [result] = await client.labelDetection(filePath);
    return result.labelAnnotations;
}

const uploadToBucket = async (filePath, labels) => {
    const {Storage} = require('@google-cloud/storage');
    const storage = new Storage();
    const bucketName = 'karl-grauers-dev-fest';
    const fileName = filePath.split('/').pop();
    const options = {destination: fileName};
    const metadata = {};

    labels.forEach(l => {
        metadata[l.label]=l.score;
    });

    await storage.bucket(bucketName).upload(filePath, options);
    await storage.bucket(bucketName).file(fileName).setMetadata({metadata})
    console.log(`${fileName} uploaded to ${bucketName}`);
}


  

module.exports = {analyzeImage, uploadToBucket} 