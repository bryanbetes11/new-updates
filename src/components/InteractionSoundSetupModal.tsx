import { Modal } from './Modal';
import { InteractionSoundSettingsPanel } from './InteractionSoundSettingsPanel';
import { Volume2 } from '../lib/lucide-react-proxy';

interface InteractionSoundSetupModalProps {
  open: boolean;
  onClose: () => void;
}

export function InteractionSoundSetupModal({ open, onClose }: InteractionSoundSetupModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sound & feedback"
      headerIcon={<Volume2 className="h-4 w-4" />}
      size="md"
      mobileView="dialog"
    >
      <InteractionSoundSettingsPanel setup onComplete={onClose} />
    </Modal>
  );
}
