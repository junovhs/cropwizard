export async function decodeImage(file: File): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const release = (): void => URL.revokeObjectURL(url);
    image.onload = () => {
      release();
      resolve(image);
    };
    image.onerror = () => {
      release();
      reject(new Error(`Could not open ${file.name}`));
    };
    image.src = url;
  });
}
