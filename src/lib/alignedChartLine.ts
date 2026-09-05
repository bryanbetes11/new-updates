// Wrap only at boundaries shared by the lyric and chord rows. Never split a chord token.
export function splitAlignedChartLine(chords: string, lyrics: string) {
  const length=Math.max(chords.length,lyrics.length);
  const top=chords.padEnd(length,' '),bottom=lyrics.padEnd(length,' ');
  const pieces:{chords:string;lyrics:string}[]=[];
  let start=0;
  for(let index=1;index<=length;index++){
    const boundary=index===length || (bottom[index-1]===' ' && bottom[index]!==' ' && top[index-1]===' ')
      || (!lyrics.trim() && top[index-1]===' ' && top[index]!==' ');
    if(boundary){pieces.push({chords:top.slice(start,index),lyrics:bottom.slice(start,index)});start=index;}
  }
  return pieces;
}
