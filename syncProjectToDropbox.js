const fs = require("fs");
const path = require("path");
require("dotenv").config();

const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;

if (DROPBOX_ACCESS_TOKEN === undefined) {
  console.error("Please set DROPBOX_ACCESS_TOKEN environment variable");
  process.exit(1);
}
const Dropbox = require("dropbox").Dropbox;
const dbx = new Dropbox({ accessToken: DROPBOX_ACCESS_TOKEN });

async function syncFolderToDropbox(projectName) {
  const dropboxFolderPath = `/BACKUP/${projectName}`;

  // Step 1: Try to fetch list of all files in the Dropbox folder
  let dropboxFiles = [];
  try {
    const result = await dbx.filesListFolder({
      path: dropboxFolderPath,
    });

    dropboxFiles = result.result.entries.map((entry) => entry.name);
  } catch (error) {
    if (error?.error?.error[".tag"] === "path") {
      // Assuming the folder doesn't exist, so we create it
      try {
        await dbx.filesCreateFolderV2({ path: dropboxFolderPath });
      } catch (createError) {
        console.error("Dropbox filesCreateFolderV2 error:", createError);
        return;
      }
    } else {
      console.error("Dropbox filesListFolder error:", error);
      return;
    }
  }

  // Step 2: Fetch list of all local files for the project
  const localFiles = [];
  const localDirPath = `uploads/${projectName}`;
  if (fs.existsSync(localDirPath)) {
    fs.readdirSync(localDirPath).forEach((file) => {
      localFiles.push(file);
    });
  }

  // Step 3: Compare and upload missing files
  for (const localFile of localFiles) {
    if (!dropboxFiles.includes(localFile)) {
      const localFilePath = path.join(localDirPath, localFile); // assuming file is in a folder named by its ID
      if (fs.existsSync(localFilePath)) {
        console.log(`Uploading missing file: ${localFile}`);
        await uploadToDropbox(
          localFilePath,
          `/BACKUP/${projectName}/${localFile}`
        );
      }
    }
  }

  // Step 4: Compare and remove extra files on Dropbox
  for (const dropboxFile of dropboxFiles) {
    if (!localFiles.includes(dropboxFile)) {
      console.log(`Removing extra file: ${dropboxFile}`);
      await removeFromDropbox(`/BACKUP/${projectName}/${dropboxFile}`);
    }
  }
}

async function syncProjectToDropbox(projectName) {
  const dropboxFolderPath = `/BACKUP/${projectName}`;

  // Step 1: Try to fetch list of all files in the Dropbox folder
  let dropboxFiles = [];
  try {
    const result = await dbx.filesListFolder({
      path: dropboxFolderPath,
    });

    dropboxFiles = result.result.entries.map((entry) => entry.name);
  } catch (error) {
    if (error?.error?.error[".tag"] === "path") {
      // Assuming the folder doesn't exist, so we create it
      try {
        await dbx.filesCreateFolderV2({ path: dropboxFolderPath });
      } catch (createError) {
        console.error("Dropbox filesCreateFolderV2 error:", createError);
        return;
      }
    } else {
      console.error("Dropbox filesListFolder error:", error);
      return;
    }
  }

  // Step 2: Fetch list of all local files for the project
  const localFiles = [];
  const localDirPath = `uploads/${projectName}`;
  if (fs.existsSync(localDirPath)) {
    fs.readdirSync(localDirPath).forEach((file) => {
      localFiles.push(file);
    });
  }

  // Step 3: Compare and upload missing files
  for (const localFile of localFiles) {
    if (!dropboxFiles.includes(localFile)) {
      const localFilePath = path.join(localDirPath, localFile, "file"); // assuming file is in a folder named by its ID
      if (fs.existsSync(localFilePath)) {
        console.log(`Uploading missing file: ${localFile}`);

        const remoteFolder = `/BACKUP/${projectName}/${localFile}`;
        const remotePath = path.join(remoteFolder, "file");
        try {
          const localRemotePath = path.join(remoteFolder, "file");

          await dbx.filesCreateFolderV2({ path: remoteFolder });
          await uploadToDropbox(localFilePath, remotePath);
        } catch (createError) {
          console.error(
            "Dropbox filesCreateFolderV2 for fileerror:",
            createError
          );
          return;
        }
      }
    }
  }

  // Step 4: Compare and remove extra files on Dropbox
  for (const dropboxFile of dropboxFiles) {
    if (!localFiles.includes(dropboxFile)) {
      console.log(`Removing extra file: ${dropboxFile}`);
      await removeFromDropbox(`/BACKUP/${projectName}/${dropboxFile}`);
    }
  }
}

async function removeFromDropbox(remotePath) {
  try {
    await dbx.filesDeleteV2({ path: remotePath });
  } catch (error) {
    console.error("Error removing from Dropbox:", error);
  }
}

async function uploadToDropbox(filePath, localRemotePath) {
  console.log(`Uploading to Dropbox: ${filePath}`);

  try {
    const file = fs.readFileSync(filePath);
    await dbx.filesUpload({
      path: localRemotePath,
      contents: file,
    });
  } catch (error) {
    console.error("Error uploading to Dropbox:", error);
  }
}

exports.syncProjectToDropbox = syncProjectToDropbox;
exports.syncFolderToDropbox = syncFolderToDropbox;
