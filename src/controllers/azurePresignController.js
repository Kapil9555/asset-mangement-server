import {
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from '@azure/storage-blob';
import dotenv from 'dotenv';
dotenv.config();

export const generateAzureUploadUrl = async (req, res) => {
    
  const { fileName, fileType } = req.body;

  if (!fileName || !fileType) {
    return res.status(400).json({ error: 'Missing fileName or fileType' });
  }

  try {
    const accountName = process.env.AZURE_ACCOUNT_NAME;
    const accountKey = process.env.AZURE_SECRET_ACCESS_KEY;
    const containerName = process.env.AZURE_CONTAINER_NAME;

    // console.log("accountName",accountName)
    // console.log("accountKey",accountKey)
    // console.log("containerName",containerName)


    const blobName = `${Date.now()}-${fileName}`;
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

    const uploadSasToken = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse('cw'), 
        expiresOn: new Date(Date.now() + 5 * 60 * 1000),
      },
      sharedKeyCredential
    ).toString();

    const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${uploadSasToken}`;

    // Permanent blob URL to save in DB
    const blobUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}`;

    res.status(200).json({ uploadUrl, blobUrl }); // Use blobUrl instead of fileUrl
  } catch (err) {
    console.error('Azure SAS URL generation error:', err);
    res.status(500).json({ error: 'Failed to generate Azure SAS URL' });
  }
};

