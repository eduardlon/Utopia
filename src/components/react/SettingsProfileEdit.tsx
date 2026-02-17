import { useState } from 'react';
import EditProfileModal from './EditProfileModal';
import { supabase } from '../../lib/supabase/client';
import type { Profile } from '../../types/database';

export default function SettingsProfileEdit() {
    const [isOpen, setIsOpen] = useState(false);

    const handleProfileUpdate = (profile: Profile) => {
        // Reload page to show changes since we are in Astro land
        window.location.reload();
    };

    return (
        <>
            <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsOpen(true)}
            >
                Editar perfil
            </button>

            {isOpen && (
                <EditProfileModal
                    isOpen={isOpen}
                    onClose={() => setIsOpen(false)}
                    onProfileUpdate={handleProfileUpdate}
                />
            )}
        </>
    );
}
