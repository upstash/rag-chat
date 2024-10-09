import { NextResponse } from 'next/server';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

export const POST = async (req: Request) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name.replace(/ /g, '_');
    const dirPath = path.join(process.cwd(), 'public', 'assets');
    const filePath = path.join(dirPath, filename);

    // Ensure the directory exists
    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
    }

    // Write the file to the specified directory
    await writeFile(filePath, buffer);
    return NextResponse.json({ message: 'File uploaded successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error occurred during file upload:', error);
    return NextResponse.json({ message: 'Failed to upload file', error }, { status: 500 });
  }
};
