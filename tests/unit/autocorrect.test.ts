import { describe, it, expect } from 'vitest';
import { autocorrectWord, autocorrectSentence, autocorrectOnDelimiter } from '../../src/domain/autocorrect/engine';

describe('Autocorrect Engine', () => {
  it('corrects high-knowledge tech brands and proper casing', () => {
    expect(autocorrectWord('chatgpt').corrected).toBe('ChatGPT');
    expect(autocorrectWord('github').corrected).toBe('GitHub');
    expect(autocorrectWord('javascript').corrected).toBe('JavaScript');
    expect(autocorrectWord('typescript').corrected).toBe('TypeScript');
    expect(autocorrectWord('reactjs').corrected).toBe('React');
    expect(autocorrectWord('nextjs').corrected).toBe('Next.js');
    expect(autocorrectWord('nodejs').corrected).toBe('Node.js');
    expect(autocorrectWord('vscode').corrected).toBe('VS Code');
    expect(autocorrectWord('openai').corrected).toBe('OpenAI');
    expect(autocorrectWord('api').corrected).toBe('API');
    expect(autocorrectWord('postgresql').corrected).toBe('PostgreSQL');
    expect(autocorrectWord('docker').corrected).toBe('Docker');
    expect(autocorrectWord('graphql').corrected).toBe('GraphQL');
  });

  it('corrects common fast-typing typos and user-specified examples', () => {
    expect(autocorrectWord('speeling').corrected).toBe('spelling');
    expect(autocorrectWord('mistaks').corrected).toBe('mistakes');
    expect(autocorrectWord('currect').corrected).toBe('correct');
    expect(autocorrectWord('correcly').corrected).toBe('correctly');
    expect(autocorrectWord('particalaty').corrected).toBe('particularly');
    expect(autocorrectWord('ditrct').corrected).toBe('direct');
    expect(autocorrectWord('opnesource').corrected).toBe('open source');
    expect(autocorrectWord('liek').corrected).toBe('like');
    expect(autocorrectWord('soemthing').corrected).toBe('something');
    expect(autocorrectWord('phycsis').corrected).toBe('physics');
    expect(autocorrectWord('keybaord').corrected).toBe('keyboard');
    expect(autocorrectWord('brnach').corrected).toBe('branch');
    expect(autocorrectWord('centrer').corrected).toBe('center');
    expect(autocorrectWord('thoght').corrected).toBe('thought');
    expect(autocorrectWord('wrok').corrected).toBe('work');
    expect(autocorrectWord('implment').corrected).toBe('implement');
    expect(autocorrectWord('deisgn').corrected).toBe('design');
  });

  it('corrects contractions and single letter i', () => {
    expect(autocorrectWord('dont').corrected).toBe("don't");
    expect(autocorrectWord('cant').corrected).toBe("can't");
    expect(autocorrectWord('im').corrected).toBe("I'm");
    expect(autocorrectWord('i').corrected).toBe('I');
  });

  it('preserves valid English words like plan and does NOT corrupt them', () => {
    expect(autocorrectWord('plan').corrected).toBe('plan');
    expect(autocorrectWord('plant').corrected).toBe('plant');
    expect(autocorrectWord('run').corrected).toBe('run');
    expect(autocorrectWord('work').corrected).toBe('work');

    const res = autocorrectSentence('plan in chatgpt');
    expect(res.text).toBe('Plan in ChatGPT');
  });

  it('corrects full sentences with grammar, first-letter capitalization, and punctuation', () => {
    const res1 = autocorrectSentence('i typee faster i cant ditrct by correcting speeling mistaks');
    expect(res1.text).toBe("I type faster I can't direct by correcting spelling mistakes");

    const res2 = autocorrectSentence('explore chatgpt api with python and postgres');
    expect(res2.text).toBe('Explore ChatGPT API with Python and PostgreSQL');

    const res3 = autocorrectSentence('implement phycsis in tree deisgn');
    expect(res3.text).toBe('Implement physics in tree design');

    const res4 = autocorrectSentence('connect github to discord and slack');
    expect(res4.text).toBe('Connect GitHub to Discord and Slack');
  });

  it('handles real-time autocorrect on delimiter (e.g. space press)', () => {
    const input = 'i love chatgpt';
    // User presses Space after 'chatgpt' at cursor position 14
    const res = autocorrectOnDelimiter(input, 14, ' ');
    expect(res.newText).toBe('i love ChatGPT ');
    expect(res.corrected).toBe(true);
    expect(res.newCursor).toBe(15);
  });
});
