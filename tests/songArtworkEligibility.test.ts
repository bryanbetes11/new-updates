import { hasArtworkArtist } from '../src/lib/songArtworkEligibility';

if (hasArtworkArtist(null)) throw new Error('null artist should not be artwork eligible');
if (hasArtworkArtist(undefined)) throw new Error('undefined artist should not be artwork eligible');
if (hasArtworkArtist('   ')) throw new Error('blank artist should not be artwork eligible');
if (!hasArtworkArtist('Hillsong Worship')) throw new Error('named artist should be artwork eligible');
