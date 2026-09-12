import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route} from 'react-router-dom';
import {AnnouncementDetail} from '../../../src/pages/AnnouncementDetail';
import '../../../src/index.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><Routes><Route path="/announcements/:id" element={<AnnouncementDetail/>}/></Routes></BrowserRouter></React.StrictMode>);
