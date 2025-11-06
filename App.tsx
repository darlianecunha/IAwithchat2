
import React, { useState } from 'react';
import ImageEditor from './components/ImageEditor';
import LiveChat from './components/LiveChat';
import { CameraIcon, MicrophoneIcon } from './components/icons/TabIcons';

type ActiveComponent = 'menu' | 'image' | 'chat';

const App: React.FC = () => {
  const [activeComponent, setActiveComponent] = useState<ActiveComponent>('menu');

  const MenuCard: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
  }> = ({ title, description, icon, onClick }) => (
    <div
      onClick={onClick}
      className="bg-gray-800/50 rounded-xl p-6 flex flex-col items-center text-center transform transition-all duration-300 hover:scale-105 hover:bg-gray-700/70 cursor-pointer shadow-lg hover:shadow-indigo-500/30"
    >
      <div className="bg-indigo-600 p-4 rounded-full mb-4">
        {icon}
      </div>
      <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );

  const renderContent = () => {
    switch (activeComponent) {
      case 'image':
        return <ImageEditor />;
      case 'chat':
        return <LiveChat />;
      case 'menu':
      default:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <MenuCard
              title="Editor de Imagem"
              description="Edite imagens com IA, adicione textos e exporte para redes sociais."
              icon={<CameraIcon />}
              onClick={() => setActiveComponent('image')}
            />
            <MenuCard
              title="Chat com IA"
              description="Converse em tempo real com um assistente de IA por voz."
              icon={<MicrophoneIcon />}
              onClick={() => setActiveComponent('chat')}
            />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            AI Media Studio
          </h1>
           <p className="mt-2 text-lg text-gray-400">
            {activeComponent === 'menu' ? 'Escolha uma ferramenta para começar.' : 'Edit images and chat with AI in real-time.'}
          </p>
        </header>
        
        {activeComponent !== 'menu' && (
          <div className="mb-4">
            <button
              onClick={() => setActiveComponent('menu')}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500"
            >
              &larr; Voltar ao Menu
            </button>
          </div>
        )}

        <main className="w-full bg-gray-800/50 rounded-xl shadow-2xl p-4 sm:p-6 lg:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
