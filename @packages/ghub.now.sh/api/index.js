import url from 'url';
import path from 'path';
import parseGithub from 'parse-github-url';

import {
  zeitLambdaWrapper,
  packageJson,
  isString,
  cleanSlashes,
  ORIGIN,
} from './_utils';

/**
 * Scoped:
 * /@tunnckocore/execa
 * /@tunnckocore/execa@5.0.2
 * /@tunnckocore/execa@5.0.2/v6-parse-function - version/tag takes precedence
 * /@tunnckocore/execa/v6-parse-function
 *
 * Non-scoped:
 * /stringify-github-short-url
 * /stringify-github-short-url@3.1.2
 * /stringify-github-short-url@3.1.2/v6-parse-function - version/tag takes precedence
 * /stringify-github-short-url/v6-parse-function
 *
 */
export default zeitLambdaWrapper(handler);

// eslint-disable-next-line max-statements
async function handler(req, res) {
  // eslint-disable-next-line node/prefer-global/url
  const parsed = new url.URL(`${ORIGIN}${req.url}`);

  if (!/^\/(?!static)(.+)/.test(parsed.pathname)) {
    res.send(parsed.pathname, 301);
    return;
  }

  const pathname = parsed.pathname.replace('/api/', '');
  const parts = cleanSlashes(pathname).split('/');

  const name = parts.length >= 2 ? parts.slice(0, 2).join('/') : parts[0];
  const ats = name.split('@');

  const isScoped = ats[0] === '';
  const version = ats.length > 1 ? (isScoped ? ats[2] : ats[1]) : null;

  let pkg = null;
  try {
    pkg = await packageJson(name);
  } catch (err) {
    res.setHeader('content-type', 'text/html');
    const msg = err.response || err.message;
    res.send(`<h1>${msg}</h1>`, 404);
    return;
  }

  const repoBranch = isScoped ? parts.slice(2) : parts.slice(1);
  const repository = (pkg.repository && pkg.repository.url) || pkg.repository;
  const directory = (pkg.repository && pkg.repository.directory) || '';
  const repoBr = repoBranch.length > 0 ? repoBranch : ['master'];

  const branch = version ? name : path.join(...repoBr);

  const dir = directory ? `/tree/${branch}/${cleanSlashes(directory)}` : '';

  const pkgUrl = repository
    ? cleanSlashes(repository.replace(/\.git$/, ''))
    : null;

  if (pkgUrl) {
    const gh = parseGithub(`${pkgUrl}${dir}`);

    if (dir) {
      const loc = `https://${gh.host}/${gh.repo}${dir}`;
      res.setHeader('X-Redirect-Location', loc);
      // res.send(`A: https://${gh.host}/${gh.repo}${dir}`);
      res.send(loc, 301);
      return;
    }

    const loc = `https://${gh.host}/${gh.repo}`;
    res.setHeader('X-Redirect-Location', loc);
    // res.send(`B: https://${gh.host}/${fp}`);
    res.send(loc, 301);
    return;
  }
  if (isString(pkg.homepage)) {
    // res.send(`C: ${pkg.homepage}`);

    res.setHeader('X-Redirect-Location', pkg.homepage);
    res.send(pkg.homepage, 301);
    return;
  }

  // res.send(`D: https://npmjs.com/package/${name}`);
  res.send(`https://npmjs.com/package/${name}`, 301);
}
