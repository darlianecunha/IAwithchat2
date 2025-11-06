import React, { useState } from 'react';
import { editImage } from '../utils/serverApi';
import { UploadIcon, LoadingSpinner } from './icons/ActionIcons';

const ImageEditor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [instruction, setInstruction] = useState('Melhore a imagem, aumente a nitidez e o contraste.');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  async function onSubmit() {
    if (!file) return;
    setLoading(true);
    setResult('');
    const { result: text, error } = await editImage(file, instruction);
    setResult(text || error || 'Sem resposta');
    setLoading(false);
  }

  return (
    <div className="p-4 bg-gray-900/40 rounded-lg border border-gray-700">
      <div className="flex items-center gap-3 mb-3">
        <label className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 text-gray-100 rounded cursor-pointer">
          <UploadIcon /> Selecionar imagem
          <input type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
        </label>
        <span className="text-gray-400 text-sm">{file ? file.name : 'Nenhuma imagem selecionada'}</span>
      </div>

      <input
        className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-gray-200 mb-3"
        value={instruction}
        onChange={e => setInstruction(e.target.value)}
        placeholder="Descreva como deseja editar a imagem"
      />

      <button onClick={onSubmit} disabled={!file || loading} className="px-4 py-2 rounded bg-emerald-600 text-white">
        {loading ? <LoadingSpinner /> : 'Enviar para IA'}
      </button>

      <div className="mt-4">
        {result && (
          <pre className="text-gray-100 whitespace-pre-wrap p-3 bg-black/30 rounded border border-gray-700">{result}</pre>
        )}
      </div>
    </div>
  );
};

export default ImageEditor;
