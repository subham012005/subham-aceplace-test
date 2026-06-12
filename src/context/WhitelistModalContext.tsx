"use client";

import React, { createContext, useContext, useState } from "react";

type WhitelistModalContextType = {
  isWhitelistReqModalOpen: boolean;
  openWhitelistModal: () => void;
  closeWhitelistModal: () => void;
};

const WhitelistModalContext = createContext<WhitelistModalContextType | null>(
  null,
);

export function WhitelistModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isWhitelistReqModalOpen, setIsWhitelistReqModalOpen] = useState(false);

  const openWhitelistModal = () => setIsWhitelistReqModalOpen(true);
  const closeWhitelistModal = () => setIsWhitelistReqModalOpen(false);

  return (
    <WhitelistModalContext.Provider
      value={{
        isWhitelistReqModalOpen,
        openWhitelistModal,
        closeWhitelistModal,
      }}
    >
      {children}
    </WhitelistModalContext.Provider>
  );
}

export function useWhitelistModal() {
  const context = useContext(WhitelistModalContext);

  if (!context) {
    throw new Error(
      "useWhitelistModal must be used inside WhitelistModalProvider",
    );
  }

  return context;
}
