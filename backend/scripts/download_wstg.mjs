import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checklistPath = path.join(root, 'wstg_checklist.json');
const wstgDir = path.join(root, 'guides', 'wstg');
const categoriesDir = path.join(wstgDir, 'categories');
const testsDir = path.join(wstgDir, 'tests');
const indexPath = path.join(wstgDir, 'index.json');

const githubApi = 'https://api.github.com/repos/OWASP/wstg/contents';
const wstgDoc = 'document/4-Web_Application_Security_Testing';
const branch = 'master';

const categoryMeta = {
  'WSTG - Information Gathering': ['info', 'WSTG-INFO', '01-Information_Gathering'],
  'WSTG - Configuration & Deployment Management': ['config', 'WSTG-CONF', '02-Configuration_and_Deployment_Management_Testing'],
  'WSTG - Identity Management': ['identity', 'WSTG-IDNT', '03-Identity_Management_Testing'],
  'WSTG - Authentication': ['authn', 'WSTG-ATHN', '04-Authentication_Testing'],
  'WSTG - Authorization': ['authz', 'WSTG-ATHZ', '05-Authorization_Testing'],
  'WSTG - Session Management': ['session', 'WSTG-SESS', '06-Session_Management_Testing'],
  'WSTG - Input Validation': ['input', 'WSTG-INPV', '07-Input_Validation_Testing'],
  'WSTG - Error Handling': ['error', 'WSTG-ERRH', '08-Testing_for_Error_Handling'],
  'WSTG - Cryptography': ['crypto', 'WSTG-CRYP', '09-Testing_for_Weak_Cryptography'],
  'WSTG - Business Logic': ['business', 'WSTG-BUSL', '10-Business_Logic_Testing'],
  'WSTG - Client-Side': ['client', 'WSTG-CLNT', '11-Client-side_Testing'],
  'WSTG - API Testing': ['api', 'WSTG-APIT', '12-API_Testing'],
};

async function ensureDirs() {
  await fs.mkdir(categoriesDir, { recursive: true });
  await fs.mkdir(testsDir, { recursive: true });
}

async function buildIndex() {
  if (!existsSync(checklistPath)) return { version: '4.2', categories: [] };
  const checklist = JSON.parse(await fs.readFile(checklistPath, 'utf8'));
  const categories = [];

  for (const [phase, items] of Object.entries(checklist)) {
    if (!categoryMeta[phase]) continue;
    const [key, catId, folder] = categoryMeta[phase];
    const tests = items.map((item) => ({
      id: item.id,
      name: item.label.replace(/^WSTG-[A-Z]+-\d+:\s*/, ''),
      description: item.description || '',
    }));
    categories.push({
      key,
      id: catId,
      name: phase.replace('WSTG - ', ''),
      folder,
      tests,
    });
  }

  return { version: '4.2', categories };
}

async function getIndex() {
  await ensureDirs();
  if (!existsSync(indexPath)) {
    await fs.writeFile(indexPath, `${JSON.stringify(await buildIndex(), null, 2)}\n`, 'utf8');
  }
  return JSON.parse(await fs.readFile(indexPath, 'utf8'));
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'redledger-build',
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

async function countFiles(dir) {
  if (!existsSync(dir)) return 0;
  const files = await fs.readdir(dir);
  return files.filter((file) => file.endsWith('.md')).length;
}

async function cachedCounts(index) {
  const expectedCategories = index.categories.length;
  const expectedTests = index.categories.reduce((count, category) => count + category.tests.length, 0);
  const categories = await countFiles(categoriesDir);
  const tests = await countFiles(testsDir);
  return { categories, tests, expectedCategories, expectedTests };
}

async function downloadWstg(index) {
  const stats = { categories: 0, tests: 0, errors: [] };

  for (const category of index.categories) {
    const listingUrl = `${githubApi}/${wstgDoc}/${category.folder}?ref=${branch}`;
    let entries;
    try {
      entries = await fetchJson(listingUrl);
    } catch (error) {
      stats.errors.push(`${category.id} listing: ${error.message}`);
      continue;
    }

    const mdFiles = entries
      .filter((entry) => entry.type === 'file' && entry.name.endsWith('.md'))
      .sort((a, b) => a.name.localeCompare(b.name));
    const readme = mdFiles.find((entry) => entry.name.toUpperCase() === 'README.MD');
    const testFiles = mdFiles.filter((entry) => entry.name.toUpperCase() !== 'README.MD');

    if (readme) {
      try {
        await fs.writeFile(path.join(categoriesDir, `${category.key}.md`), await fetchText(readme.download_url), 'utf8');
        stats.categories += 1;
      } catch (error) {
        stats.errors.push(`${category.id} README: ${error.message}`);
      }
    }

    for (const [indexInCategory, entry] of testFiles.entries()) {
      if (indexInCategory >= category.tests.length) break;
      const testId = category.tests[indexInCategory].id;
      try {
        await fs.writeFile(path.join(testsDir, `${testId}.md`), await fetchText(entry.download_url), 'utf8');
        stats.tests += 1;
      } catch (error) {
        stats.errors.push(`${testId}: ${error.message}`);
      }
    }
  }

  return stats;
}

async function main() {
  const index = await getIndex();
  const before = await cachedCounts(index);
  if (before.categories >= before.expectedCategories && before.tests >= before.expectedTests) {
    console.log(JSON.stringify({ status: 'cached', categories: before.categories, tests: before.tests }));
    return;
  }

  const stats = await downloadWstg(index);
  const after = await cachedCounts(index);
  console.log(JSON.stringify({
    status: 'downloaded',
    categories: after.categories,
    tests: after.tests,
    downloaded_categories: stats.categories,
    downloaded_tests: stats.tests,
    errors: stats.errors,
  }, null, 2));

  if (after.categories < after.expectedCategories || after.tests < after.expectedTests) {
    process.exitCode = 1;
  }
}

await main();
