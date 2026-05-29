import React from 'react';

const PromptAddIcon: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg className={className} viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17 9V25M9 17H25"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default PromptAddIcon;
