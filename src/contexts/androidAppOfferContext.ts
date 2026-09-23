import { createContext, useContext } from 'react';
export const AndroidAppOfferContext = createContext({ attention: false, popup: false });
export const useAndroidAppOfferAvailable = () => useContext(AndroidAppOfferContext).attention;
export const useAndroidAppPopupAvailable = () => useContext(AndroidAppOfferContext).popup;
