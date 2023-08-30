// https://rokka.io/documentation/references/operations.html#crop
// [

//     {
//         "name": "crop",
//         "options": {
//             "area": "test"
//         }
//     },
//     {
//         "name": "resize",
//         "options": {
//             "width": 200,
//             "height": 200
//         }
//     },
// ],

// from an object to the rokka notation
// input
//       resize: {
//         width: 300,
//       },
//       crop: {
//         height: 200
//       }
// output
//       resize-width-300--crop-height-200
// export const flattenObject = obj => {
//     const toReturn = []
//     if (obj === null) {
//       return ''
//     }
//     Object.keys(obj).forEach(key => {
//       toReturn.push(`${key}-${obj[key]}`)
//     })
//     return toReturn
//   }

//   optionsStr = flattenObject(options).join('-')

// resize-width:300-height:200--

export function urlToStack(url = "") {
  const result = [];

  const stacks = url.split(";").filter((item) => item);

  return stacks.map((stack) => {
    const operation = { type: "", options: {} };
    const [type, definition] = (stack || "").split("@").filter((item) => item);
    const elements = (definition || "").split(",").filter((item) => item);
    operation.type = (type || "").trim().toLowerCase();

    elements.forEach((element) => {
      const [key, value] = (element || "").split(":").filter((item) => item);
      operation.options[key.trim().toLowerCase()] = decodeURI(
        value.trim().toLowerCase()
      );
    });

    return operation;
  });
}
