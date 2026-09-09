import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { readChartUploadFiles } from '../../src/lib/songBookProImport';
import { normalizeImportedChordSheet } from '../../src/lib/chordSheetAdapter';
import { parseChordProMetadata } from '../../src/lib/chordPro';
import '../../src/index.css';
function Fixture() {
  const [result, setResult] = useState([]);
  const [error, setError] = useState('');
  return <main style={{padding:24,color:'white',background:'#09090b',minHeight:'100vh'}}>
    <h1>ServeSync chart import QA — no database writes</h1>
    <label>Choose chart files<input type="file" accept=".cho,.sbp" multiple onChange={async event => {
      setError(''); setResult([]);
      try {
        const {charts} = await readChartUploadFiles(Array.from(event.target.files));
        setResult(charts.map(chart => parseChordProMetadata(normalizeImportedChordSheet(chart.text).chordproText)));
      } catch (failure) { setError(failure.message); }
    }}/></label>
    <p role="status">{result.length} charts ready for review</p>
    {error && <p role="alert">{error}</p>}
    <ul>{result.map((song,index)=><li key={index}>{song.title} — {song.artist || 'No artist'} — {song.key || 'No key'}</li>)}</ul>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
