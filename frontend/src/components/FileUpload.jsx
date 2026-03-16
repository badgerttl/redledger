import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';

export default function FileUpload({ onDrop, accept, label = 'Drop files here or click to upload' }) {
  const handleDrop = useCallback((files) => {
    if (onDrop) onDrop(files);
  }, [onDrop]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept,
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors duration-150 ${
        isDragActive ? 'border-accent bg-accent/5' : 'border-border hover:border-text-muted'
      }`}
    >
      <input {...getInputProps()} />
      <Upload className="w-8 h-8 text-text-muted mx-auto mb-2" />
      <p className="text-sm text-text-secondary">{label}</p>
    </div>
  );
}
