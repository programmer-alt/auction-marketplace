import { Upload, X } from "lucide-react";
import type React from "react";

interface ImageUploaderProps {
  preview: string | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ preview, onFileChange, onRemove }) => {
  if (preview) {
    return (
      <div className="relative">
        <img src={preview} alt="preview" className="w-full h-48 object-cover rounded-lg" />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
      <Upload className="h-8 w-8 text-gray-400 mb-2" />
      <span className="text-sm text-gray-500">Нажмите для загрузки</span>
      <span className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP до 5MB</span>
      <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
    </label>
  );
};

export default ImageUploader;
