import fs from "fs";
import path from "path";
import { Dropbox } from "dropbox";
import dotenv from "dotenv";
dotenv.config();

const ROOT_UPLOAD_PATH = process.env.ROOT_UPLOAD_PATH;
const ROOT_CACHE_PATH = process.env.ROOT_CACHE_PATH;

const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY;
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET;
const DROPBOX_ROOT_ID = process.env.DROPBOX_ROOT_ID || "production";

const DROPBOX_ROOT = `/BACKUP/${DROPBOX_ROOT_ID}`;

if (DROPBOX_APP_KEY === undefined) {
  console.error("Please set DROPBOX_APP_KEY environment variable");
  process.exit(1);
}
if (DROPBOX_APP_SECRET === undefined) {
  console.error("Please set DROPBOX_APP_SECRET environment variable");
  process.exit(1);
}

// Initialize Dropbox SDK
export const dbx = new Dropbox({
  clientId: DROPBOX_APP_KEY,
  clientSecret: DROPBOX_APP_SECRET,
});

/*
async function createFolderRecursively(dbx, folderPath) {
  const folders = folderPath.split('/').filter(Boolean);
  let currentPath = '';

  for (const folder of folders) {
    currentPath += `/${folder}`;
    try {
      // Try to create the folder. If it already exists, an error is thrown
      await dbx.filesCreateFolderV2({ path: currentPath });
      console.log(`Folder created: ${currentPath}`);
    } catch (error) {
      // Check if the error is because the folder already exists
      if (error?.error?.error?.['.tag'] !== 'path_lookup' && error?.error?.error?.path?.['.tag'] !== 'conflict') {
        // If the error is not due to the folder already existing, throw the error
        throw error;
      }
      console.log(`Folder already exists: ${currentPath}`);
    }
  }
}
*/

export async function syncFolderToDropbox(projectName) {
  const dropboxFolderPath = `${DROPBOX_ROOT}/${projectName}`;

  // Step 1: Try to fetch list of all files in the Dropbox folder
  let dropboxFiles = [];
  try {
    const result = await dbx.filesListFolder({
      path: dropboxFolderPath,
    });

    dropboxFiles = result.result.entries.map((entry) => entry.name);
  } catch (error) {
    console.log("error on dropbox filesListFolder");
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
  const localDirPath = `${ROOT_UPLOAD_PATH}/${projectName}`;
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
          `${DROPBOX_ROOT}/${projectName}/${localFile}`
        );
      }
    }
  }

  // Step 4: Compare and remove extra files on Dropbox
  for (const dropboxFile of dropboxFiles) {
    if (!localFiles.includes(dropboxFile)) {
      console.log(`Removing extra file: ${dropboxFile}`);
      await removeFromDropbox(`${DROPBOX_ROOT}/${projectName}/${dropboxFile}`);
    }
  }
}

export async function syncProjectToDropbox(projectName) {
  const dropboxFolderPath = `${DROPBOX_ROOT}/${projectName}`;

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
  const localDirPath = `${ROOT_UPLOAD_PATH}/${projectName}`;
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

        const remoteFolder = `${DROPBOX_ROOT}/${projectName}/${localFile}`;
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
      await removeFromDropbox(`${DROPBOX_ROOT}/${projectName}/${dropboxFile}`);
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
