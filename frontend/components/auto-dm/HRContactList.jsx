import React from 'react';
import HRContactItem from './HRContactItem';

export default function HRContactList({ contacts, onGenerateMessage }) {
  if (!contacts || contacts.length === 0) {
    return <div className="text-slate-400 text-sm">No contacts available to display.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {contacts.map((contact, idx) => (
        <HRContactItem 
          key={idx} 
          contact={contact} 
          onGenerateMessage={onGenerateMessage} 
        />
      ))}
    </div>
  );
}
