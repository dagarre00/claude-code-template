# Adversarial reviews with Claude Code — r/ClaudeCode

**Source:** https://www.reddit.com/r/ClaudeCode/s/TUOQdqcQmK
**Author:** u/croovies
**Retrieved:** 2026-07-31 (pasted into the session by the human; reddit.com is not fetchable from this environment)
**Score at retrieval:** ~260 upvotes

---

## Post text (verbatim as supplied)

> You're shipping bugs if you're not using adversarial reviews with claude code

Once you start handing real work to an agent, you stop being the person who writes the code and become the person who's answerable for it. That's a good trade, but it changes your job. When something breaks in production nobody's going to ask how the code got written. They're going to look at you.

Left alone, an agent produces slop. Not because it's stupid — because that's what anything does when nobody checks its work. A junior does the same. So might you on a bad day.

There are roughly two ways to run an agent. You can sit on top of it and drive every step, which is quicker than typing the code yourself but leaves you babysitting: every time it pauses and resumes you have to load the whole problem context back into your head, and if you look away and get distracted, that ends up slower than just doing the work.

The other way is to treat it like someone who reports to you. You say what you want and roughly how, and you come back when there's something worth looking at. This is how senior engineers use agentic tools. You don't need to watch every keystroke to be accountable for the result — no manager does — but the review lands on you, and if you skip it, slop is what goes out the door.

### So point a second model at it and tell it to find the problems

That's all an adversarial review is. One model writes the code. A different one — or at least one that hasn't touched any of the context — reads the diff and goes looking for what's wrong. It doesn't get to touch your code; it can only raise findings. The author model decides what to act on. Then it reads the result again. Most of the time it finds something.

You get better code out of it, but that's not really why you do it. You do it so you can trust work you didn't watch get written. The agent already handed you the time — another round, more tests, a second set of eyes that costs nothing but tokens. This is what you spend it on.

### The data

Looking at my last 83 completed tickets that got a Codex review, at least 67 ended in a real change to the code — something the first pass got wrong or left exposed, caught before it went out. That's four out of five reviews turning up something worth fixing.

Sorted by what kind of problem they were, across all 122 commits these reviews drove:

| Category             | Share of commits |
| -------------------- | ---------------- |
| Correctness / logic  | 34%              |
| Concurrency / races  | 22%              |
| Durability / data    | 19%              |
| Security / injection | 9%               |
| Test integrity       | 9%               |
| Other (docs, dead code) | 7%            |

Half of every commit these reviews drove were the incident kind. Concurrency, durability, security. The stuff that corrupts data or leaks a secret, not the stuff that misaligns a button.

### The claude skill

- Run them side by side. The author in one session, a reviewer in another — Codex, or a fresh Claude with none of your context — both pointed at the same working directory so the reviewer can see your diff. When the reviewer finds something, paste it into the author; when the author fixes it or pushes back, paste that over.
- Use a file as the mailbox. Have the reviewer write its findings to a file (or a PR comment) instead of chatting, then hand that file to the author to work through. No live channel needed — the review is just a document that gets passed along.

The brief to the reviewer is the same:

> You're reviewing the change in this working directory. You're read-only: review and discuss only, do not edit files, commit, push, or reset the tree. Run `git rev-parse HEAD` and `git status` first, and anchor every finding to that commit. Write your findings out as a numbered list, don't touch the code.

The wording doesn't matter as long as it's a second model that hasn't seen your context, told to find what's wrong, before you call the work done.
