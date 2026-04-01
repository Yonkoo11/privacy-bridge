# Privacy Bridge Demo -- Voiceover Script

Target: 65-80s. 6 clips. PL Genesis judges.
Track: Existing Code. Bounties: Flow Blockchain, Storacha.
Judging: Technical execution, originality, usability, chain integration.

Show first, explain second. Sound like a dev showing a project, not a pitch deck.
Audio: ElevenLabs Brian, stability 0.82, style 0.03.

## 01-landing
**Frame:** Landing page with hero flow line and chain transit map
**Text:** "This is Privacy Bridge. You deposit tokens on any of six EVM chains. You withdraw on Starknet. There is no on-chain link between the two transactions. The chain map at the top shows all six source networks pointing to a single Starknet destination."

## 02-deposit
**Frame:** Deposit page with denomination selector and pool size indicator
**Text:** "On the deposit side, you pick a fixed denomination and lock tokens into the bridge contract. The pool size counter reads from the chain in real time so you can see how many other deposits are in the set. More deposits means better privacy."

## 03-note
**Frame:** Deposit page showing generated note with commitment box and backup checkbox
**Text:** "After locking, you get a secret note. This note is the only way to withdraw later. You have to check the backup confirmation before the app lets you proceed. Lose the note, lose the funds. That is by design."

## 04-withdraw
**Frame:** Withdraw page with declassify button and progress tracker showing steps
**Text:** "Withdrawal is one click. You paste the note, enter a Starknet address, and hit Declassify. The app builds a Groth16 proof, fetches the garaga calldata, and relays to Starknet automatically. Each step shows elapsed time so you know what is happening."

## 05-dashboard
**Frame:** Dashboard showing pool anonymity bar, denominations, merkle root
**Text:** "The dashboard pulls deposit counts and the latest Merkle root directly from the bridge contract on whichever chain you are connected to. Five chains are live right now with identical contracts deployed on each one."

## 06-close
**Frame:** Landing page hero (clean top shot)
**Text:** "Six source chains. One Starknet destination. Zero link between deposit and withdrawal. That is Privacy Bridge."
