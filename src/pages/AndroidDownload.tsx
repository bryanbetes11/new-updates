import { Link } from 'react-router-dom';
import { ANDROID_TEST_RELEASE } from '../lib/androidDownload';

const steps: { title: string; description: string; image?: string; alt?: string; caption?: string }[] = [
  { title: 'Download the APK', description: 'Tap Download Android app. If your browser asks whether to keep the APK file, confirm only when the filename matches the one shown on this page.' },
  { title: 'Open the download', description: 'Open your browser’s Downloads or Files → Downloads, then tap the ServeSync APK.' },
  { title: 'Allow this installation source, if asked', description: 'If Android says this source is not allowed to install apps, tap Settings and turn on “Allow from this source” for the browser or Files app you used. Return to the installer. You can turn this permission off afterward.' },
  { title: 'Tap Install', description: 'Check that the installer shows ServeSync and its green icon, then tap Install. If you already have ServeSync, Android may offer Update instead.', image: '/android-install/install-confirmation.png', alt: 'Android installer showing ServeSync with Cancel and Install buttons.', caption: 'Tap Install at the bottom right.' },
  { title: 'If Play Protect appears, tap More details', description: 'You may see “App blocked to protect your device” because Play Protect has not seen this developer before. For the ServeSync APK downloaded from this page, tap More details to read the available options. If Android offers a scan, let it scan.', image: '/android-install/play-protect-more-details.png', alt: 'Google Play Protect unfamiliar-developer notice for ServeSync, with More details above the OK button.', caption: 'Tap More details above the blue OK button.' },
  { title: 'Review the notice, then tap Install anyway', description: 'If you trust this ServeSync download and Android offers Install anyway, tap that option to continue. Keep Play Protect enabled. If the warning identifies harmful behavior or there is no installation option, stop and send the warning to your church administrator.', image: '/android-install/play-protect-install-anyway.png', alt: 'Expanded Play Protect notice for ServeSync showing the Install anyway option above OK.', caption: 'Tap Install anyway, not the blue OK button.' },
  { title: 'Open ServeSync and sign in', description: 'After installation finishes, tap Open and sign in with your existing account. When Android asks to allow notifications, tap Allow if you want messages and reminders on your lock screen.' },
];

export function AndroidDownload() {
  return (
    <main className="h-dvh overflow-y-auto overscroll-contain bg-[#080c0b] px-5 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))] text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-300">← Back to ServeSync</Link>
        <header className="mt-8 border-b border-white/10 pb-9">
          <img src="/pwa-icon-192.png" alt="ServeSync" className="mb-6 h-20 w-20 rounded-3xl" />
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Android testing release</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Your team. One Android app.</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/65">Take ServeSync’s schedules, songs, Chat, and notifications with you. Your existing account and church data work in the Android app.</p>
          <a href={ANDROID_TEST_RELEASE.url} className="mt-7 inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-400 px-6 font-bold text-[#062318] hover:bg-emerald-300">Download Android app</a>
          <p className="mt-3 text-sm text-white/55">Version {ANDROID_TEST_RELEASE.version} · Build {ANDROID_TEST_RELEASE.build} · Android with Google Play services</p>
          <p className="mt-2 break-all text-xs text-white/40">{ANDROID_TEST_RELEASE.filename}</p>
          <p className="mt-4 text-sm leading-6 text-white/55">This is a development testing build, not a Google Play release. iPhones cannot install APK files; you can keep using the PWA.</p>
        </header>
        <section aria-labelledby="installation-heading" className="py-9">
          <h2 id="installation-heading" className="text-2xl font-bold">Install in a few steps</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">These screenshots show one Android installation flow. Wording and the order of prompts can vary by phone. Tap a screenshot to view it larger.</p>
          <ol className="mt-7 space-y-7">
            {steps.map(({ title, description, image, alt, caption }, index) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-sm font-bold text-emerald-300">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/65">{description}</p>
                  {image && (
                    <figure className="mt-4 max-w-sm">
                      <a href={image} target="_blank" rel="noopener noreferrer" aria-label={`View larger screenshot: ${title}`} className="block overflow-hidden rounded-2xl border border-white/10 bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300">
                        <img src={image} alt={alt} loading="lazy" className="h-auto w-full" />
                      </a>
                      <figcaption className="mt-2 text-xs font-semibold leading-5 text-emerald-200">{caption}</figcaption>
                    </figure>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.035] p-6" aria-label="Updates and help">
          <div><h2 className="font-bold">Updating an existing APK</h2><p className="mt-2 text-sm leading-6 text-white/65">Download the newer file and install it over ServeSync. Do not uninstall first. If Android refuses the update, contact your administrator before uninstalling, so you don’t lose local drafts.</p></div>
          <div><h2 className="font-bold">Notifications are optional</h2><p className="mt-2 text-sm leading-6 text-white/65">If you choose Don’t allow, ServeSync still works. A banner will remind you that lock-screen alerts are off and help you enable them later. The PWA and APK have separate notification permissions; keeping both enabled may show duplicate alerts.</p></div>
          <div><h2 className="font-bold">What updates automatically?</h2><p className="mt-2 text-sm leading-6 text-white/65">Messages and church content sync normally. New screens and app fixes require a newer APK during testing. This page will show the available version.</p></div>
        </section>
      </div>
    </main>
  );
}
