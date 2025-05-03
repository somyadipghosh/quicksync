import React, { useState } from 'react';
import { copyToClipboard } from '../../utils/helpers';

const CopyButton = ({ text, label = "Copy", successLabel = "Copied!" }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    const success = await copyToClipboard(text);
    
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  return (
    <button
      onClick={handleCopy}
      className={`
        px-3 py-1 text-sm rounded-md transition-colors duration-200 focus:outline-none
        ${copied ? 'bg-green-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}
      `}
    >
      {copied ? successLabel : label}
    </button>
  );
};

export default CopyButton;