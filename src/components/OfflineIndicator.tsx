import React from 'react';
import {WifiOff} from 'lucide-react';
import {useOnlineStatus} from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-[#FDEEDF] border-b border-[#F4A261] px-4 py-2 text-xs font-bold text-[#263238]"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-[#C62828]" />
      <span>
        Sin conexión a internet. Las mediciones se sincronizarán al reconectar.
      </span>
    </div>
  );
};
