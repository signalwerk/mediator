import fs from "fs";
import path from "path";
import sharp from "sharp";
import objHash from "object-hash";

const ROOT_UPLOAD_PATH = process.env.ROOT_UPLOAD_PATH;
const ROOT_CACHE_PATH = process.env.ROOT_CACHE_PATH;

function rootPathGet({ project, identifier }) {
  return `${ROOT_UPLOAD_PATH}/${project}/${identifier}`;
}
function rootCachePathGet({ project, identifier }) {
  return `${ROOT_CACHE_PATH}/${project}/${identifier}`;
}

export async function getProcessed({
  project,
  operations,
  format,
  identifier,
}) {
  const { path: cachePath, status } = isCached({
    project,
    operations,
    format,
    identifier,
  });

  if (status) {
    return fs.readFileSync(cachePath);
  }

  const path = getAsset({ project, identifier });

  const img = await computeImage({ path, operations, format });

  const dirname = rootCachePathGet({ project, identifier });
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }

  fs.writeFile(cachePath, img, (err) => {
    if (err) console.log(err);
  });

  return img;
}

export function isCached({ project, operations, format, identifier }) {
  const cachKey = objHash({ project, operations, format, identifier });

  const cachePath = path.join(
    rootCachePathGet({ project, identifier }),
    `${cachKey}.${format}`
  );

  if (fs.existsSync(cachePath)) {
    return { path: cachePath, status: true };
  }
  return { path: cachePath, status: false };
}

export function getAsset({ project, identifier }) {
  const fullSearchPath = rootPathGet({
    project,
    identifier,
  });

  if (!fs.existsSync(fullSearchPath)) {
    throw new Error(`cant find identifier ${identifier} (${fullSearchPath})`);
  }

  const fullPath = path.join(fullSearchPath, "file");

  if (!fs.existsSync(fullPath)) {
    throw new Error(`cant find file for ${identifier}`);
  }

  return fullPath;
}

export function getSharpOfStorage({ path }) {
  try {
    if (!fs.existsSync(path)) {
      throw new Error(`cant find ${path}`);
    }
  } catch (err) {
    throw new Error(`error during access ${path}`);
  }

  return sharp(path);
}

export async function getInfo({ project, operations, format, identifier }) {
  const { path: cachePath, status } = isCached({
    project,
    operations,
    format,
    identifier,
  });

  if (status) {
    return JSON.parse(fs.readFileSync(cachePath));
  }

  const path = getAsset({ project, identifier });

  let img = await getSharpOfStorage({ path });

  const { orientation } = await img.metadata();

  const metadata = await img.metadata();

  const result = { ...metadata };

  switch (orientation) {
    case 1:
    case 2:
    case 3:
    case 4:
      result.normalizedWidth = metadata.width;
      result.normalizedHeight = metadata.height;
      break;
    case 5:
    case 6:
    case 7:
    case 8:
      result.normalizedWidth = metadata.height;
      result.normalizedHeight = metadata.width;
      break;
    default:
      result.normalizedWidth = metadata.width;
      result.normalizedHeight = metadata.height;
  }

  const dirname = rootCachePathGet({ project, identifier });

  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }

  fs.writeFile(cachePath, JSON.stringify(result, null, 2), (err) => {
    if (err) console.log(err);
  });

  return result;
}

export async function computeImage({ path, operations, format }) {
  let img = await getSharpOfStorage({ path });
  img = await transformImage(img, operations);
  const buffer = await getBufferOfImg(img, format);

  return buffer;
}

export async function transformImage(img, operations) {
  const { orientation } = await img.metadata();

  img = img.withMetadata().rotate();
  img = sharp(await img.toBuffer());

  operations.forEach((operation) => {
    switch (operation.type) {
      case "resize": {
        const width = operation.options.width
          ? parseInt(operation.options.width, 10)
          : null;
        const height = operation.options.height
          ? parseInt(operation.options.height, 10)
          : null;
        const fit = operation.options.fit || "cover";
        try {
          img = img.resize(width, height, {
            fit,
            withoutEnlargement: true,
          });
        } catch (err) {
          console.log(err);
        }
        break;
      }
      case "rotate": {
        const angle = operation.options.angle
          ? parseInt(operation.options.angle, 10)
          : null;
        try {
          img = img.rotate(angle);
        } catch (err) {
          console.log(err);
        }
        break;
      }
      case "flatten": {
        const background = operation.options.background;

        try {
          img = img.flatten({
            background: `#${background}`,
          });
        } catch (err) {
          console.log(err);
        }

        break;
      }
      case "crop": {
        const left = operation.options.left
          ? parseInt(operation.options.left, 10)
          : 0;

        const top = operation.options.top
          ? parseInt(operation.options.top, 10)
          : 0;
        const width = operation.options.width
          ? parseInt(operation.options.width, 10)
          : null;
        const height = operation.options.height
          ? parseInt(operation.options.height, 10)
          : null;

        try {
          img = img.extract({
            left,
            top,
            width,
            height,
          });
        } catch (error) {
          console.log(`An error occurred during processing: ${error}`);
        }

        break;
      }

      default: {
        throw new Error(`Sorry, no transforamation ${operation.type}.`);
      }
    }
  });
  return img;
}

export async function getBufferOfImg(img, format) {
  try {
    const buffer = await img
      .toFormat(format, {
        // quality: quality
      })
      .toBuffer();
    return buffer;
  } catch (error) {
    throw new Error(error);
  }
}
