import { splitAlignedChartLine } from '../lib/alignedChartLine';

export function AlignedChartLine({chords,lyrics,chordSize,lyricSize,chordClass,lyricClass,chordBold,lyricBold,chordItalic,lyricItalic}: {
  chords:string;lyrics:string;chordSize:number;lyricSize:number;chordClass:string;lyricClass:string;
  chordBold:boolean;lyricBold:boolean;chordItalic:boolean;lyricItalic:boolean;
}) {
  const size=Math.max(chordSize,lyricSize);
  const hasChords=!!chords.trim();
  const hasLyrics=!!lyrics.trim();
  return <div className="flex flex-wrap items-end font-mono" style={{fontSize:size}}>
    {splitAlignedChartLine(chords,lyrics).map((part,index)=><span key={index} className="inline-flex max-w-full shrink-0 flex-col overflow-x-auto whitespace-pre" onPointerDown={event=>{if(event.currentTarget.scrollWidth>event.currentTarget.clientWidth)event.stopPropagation();}}>
      {hasChords&&<span data-chart-chords="true" className={chordClass} style={{minHeight:chordSize*1.55,fontSize:chordSize,letterSpacing:(size-chordSize)*0.6,fontWeight:chordBold?900:400,fontStyle:chordItalic?'italic':'normal',lineHeight:1.55}}>{part.chords || ' '}</span>}
      {hasLyrics&&<span className={lyricClass} style={{minHeight:lyricSize*1.6,fontSize:lyricSize,letterSpacing:(size-lyricSize)*0.6,fontWeight:lyricBold?800:400,fontStyle:lyricItalic?'italic':'normal',lineHeight:1.6}}>{part.lyrics || ' '}</span>}
    </span>)}
  </div>;
}
