import { Permissions, webMethod } from "wix-web-module";

// Function to encode string to Base64
export function toBase64(str) {
  // Encode the string to a Uint8Array (UTF-8)
  const uint8Array = new TextEncoder().encode(str);

  // Convert the Uint8Array to a binary string
  let binaryString = "";
  uint8Array.forEach((byte) => {
    binaryString += String.fromCharCode(byte);
  });

  // Convert the binary string to Base64
  return btoa(binaryString);
}

// Function to decode Base64 back to the original string
// Wrap in "webMethod" handler because this is used in the frontend
export const fromBase64 = webMethod(Permissions.Anyone, async (base64Str) => {
  // Decode the Base64 string to a binary string
  const binaryString = atob(base64Str);

  // Convert the binary string to a Uint8Array
  const uint8Array = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    uint8Array[i] = binaryString.charCodeAt(i);
  }

  // Decode the Uint8Array to a string using TextDecoder
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(uint8Array);
});
