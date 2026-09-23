import { createContext, useContext } from 'react';
export const AndroidAppOfferContext = createContext(false);
export const useAndroidAppOfferAvailable = () => useContext(AndroidAppOfferContext);
