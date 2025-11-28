

import {
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol
} from '@azure/storage-blob';

export const generateAzureUploadUrl = async (req, res) => {
  const { fileName, fileType } = req.body;
  if (!fileName || !fileType) return res.status(400).json({ error: 'Missing fileName or fileType' });

  const accountName   = process.env.AZURE_ACCOUNT_NAME;     
  const accountKey    = process.env.AZURE_STORAGE_ACCOUNT_KEY || process.env.AZURE_SECRET_ACCESS_KEY;
  const containerName = process.env.AZURE_CONTAINER_NAME;   
  if (!accountName || !accountKey || !containerName) {
    return res.status(500).json({ error: 'Azure env vars missing' });
  }

  // Keep original name (spaces allowed), but produce a safe variant if you prefer
  const ext  = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
  const base = fileName.replace(ext, '');
  const blobName = `${Date.now()}-${base}${ext}`; // raw — includes spaces

  const creds = new StorageSharedKeyCredential(accountName, accountKey);

  // One base time to ensure se > st
  const now = new Date();
  const startsOn  = new Date(now.getTime() - 10 * 60 * 1000);  // 10 min ago
  const expiresOn = new Date(now.getTime() + 2  * 60 * 60 * 1000); // 2 hours

  const sas = generateBlobSASQueryParameters({
    containerName,
    blobName,                                 // RAW here (no encoding!)
    permissions: BlobSASPermissions.parse('cw'),
    protocol: SASProtocol.Https,
    startsOn,
    expiresOn,
    version: '2021-08-06',                    // pin a stable version
  }, creds).toString();

  // Encode ONLY the path segment for the URL:
  const encodedBlobName = encodeURIComponent(blobName);
  const baseUrl  = `https://${accountName}.blob.core.windows.net/${containerName}/${encodedBlobName}`;
  const uploadUrl = `${baseUrl}?${sas}`;
  const blobUrl   = baseUrl;                  // permanent URL without SAS

  return res.status(200).json({ uploadUrl, blobUrl });
};
