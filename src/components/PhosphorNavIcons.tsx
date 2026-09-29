import type { Icon, IconProps } from '@phosphor-icons/react';
import { ArrowsLeftRightIcon } from '@phosphor-icons/react/dist/csr/ArrowsLeftRight';
import { CalendarCheckIcon } from '@phosphor-icons/react/dist/csr/CalendarCheck';
import { CalendarDotsIcon } from '@phosphor-icons/react/dist/csr/CalendarDots';
import { ChatCircleIcon } from '@phosphor-icons/react/dist/csr/ChatCircle';
import { EyeIcon } from '@phosphor-icons/react/dist/csr/Eye';
import { GearSixIcon } from '@phosphor-icons/react/dist/csr/GearSix';
import { HouseIcon } from '@phosphor-icons/react/dist/csr/House';
import { ListChecksIcon } from '@phosphor-icons/react/dist/csr/ListChecks';
import { MusicNotesIcon } from '@phosphor-icons/react/dist/csr/MusicNotes';
import { NewspaperIcon } from '@phosphor-icons/react/dist/csr/Newspaper';
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { SpeakerHighIcon } from '@phosphor-icons/react/dist/csr/SpeakerHigh';
import { StackIcon } from '@phosphor-icons/react/dist/csr/Stack';
import { UsersThreeIcon } from '@phosphor-icons/react/dist/csr/UsersThree';
import { VideoCameraIcon } from '@phosphor-icons/react/dist/csr/VideoCamera';

export type NavigationIconProps = Pick<IconProps, 'className' | 'style'> & {
  active?: boolean;
};

export type NavigationIcon = React.ComponentType<NavigationIconProps>;

function createNavigationIcon(Glyph: Icon): NavigationIcon {
  function NavigationStateIcon({
    active = false,
    className,
    style,
  }: NavigationIconProps) {
    return (
      <Glyph
        aria-hidden="true"
        className={className}
        data-icon-weight={active ? 'fill' : 'regular'}
        style={style}
        weight={active ? 'fill' : 'regular'}
      />
    );
  }

  NavigationStateIcon.displayName = `${Glyph.displayName || 'Phosphor'}NavigationIcon`;
  return NavigationStateIcon;
}

export const HomeNavIcon = createNavigationIcon(HouseIcon);
export const EventsNavIcon = createNavigationIcon(CalendarDotsIcon);
export const AnnouncementsNavIcon = createNavigationIcon(NewspaperIcon);
export const MessagesNavIcon = createNavigationIcon(ChatCircleIcon);
export const LibraryNavIcon = createNavigationIcon(StackIcon);
export const SongsNavIcon = createNavigationIcon(MusicNotesIcon);
export const SetsNavIcon = createNavigationIcon(ListChecksIcon);
export const VideosNavIcon = createNavigationIcon(VideoCameraIcon);
export const LeaveNavIcon = createNavigationIcon(CalendarCheckIcon);
export const SwapsNavIcon = createNavigationIcon(ArrowsLeftRightIcon);
export const TeamNavIcon = createNavigationIcon(UsersThreeIcon);
export const SettingsNavIcon = createNavigationIcon(GearSixIcon);
export const PrivacyNavIcon = createNavigationIcon(ShieldCheckIcon);
export const SoundNavIcon = createNavigationIcon(SpeakerHighIcon);
export const MemberViewNavIcon = createNavigationIcon(EyeIcon);
