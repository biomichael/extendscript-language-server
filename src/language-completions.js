const LANGUAGE_COMPLETIONS = {
  function: {
    kind: 'keyword',
    detail: 'ExtendScript function declaration',
    insertText: 'function ${1:name}(${2:args}) {\n\t${0}\n}',
    snippet: true
  },
  var: {kind: 'keyword', detail: 'JavaScript declaration'},
  let: {kind: 'keyword', detail: 'JavaScript declaration'},
  const: {kind: 'keyword', detail: 'JavaScript declaration'},
  if: {kind: 'keyword', detail: 'JavaScript statement'},
  else: {kind: 'keyword', detail: 'JavaScript statement'},
  for: {kind: 'keyword', detail: 'JavaScript statement'},
  while: {kind: 'keyword', detail: 'JavaScript statement'},
  do: {kind: 'keyword', detail: 'JavaScript statement'},
  switch: {kind: 'keyword', detail: 'JavaScript statement'},
  case: {kind: 'keyword', detail: 'JavaScript statement'},
  default: {kind: 'keyword', detail: 'JavaScript statement'},
  try: {kind: 'keyword', detail: 'JavaScript statement'},
  catch: {kind: 'keyword', detail: 'JavaScript statement'},
  finally: {kind: 'keyword', detail: 'JavaScript statement'},
  throw: {kind: 'keyword', detail: 'JavaScript statement'},
  return: {kind: 'keyword', detail: 'JavaScript statement'},
  break: {kind: 'keyword', detail: 'JavaScript statement'},
  continue: {kind: 'keyword', detail: 'JavaScript statement'},
  new: {kind: 'keyword', detail: 'JavaScript operator'},
  delete: {kind: 'keyword', detail: 'JavaScript operator'},
  typeof: {kind: 'keyword', detail: 'JavaScript operator'},
  instanceof: {kind: 'keyword', detail: 'JavaScript operator'},
  with: {kind: 'keyword', detail: 'ExtendScript statement'},
  in: {kind: 'keyword', detail: 'JavaScript operator'},
  this: {kind: 'keyword', detail: 'JavaScript reference'},
  true: {kind: 'keyword', detail: 'Boolean literal'},
  false: {kind: 'keyword', detail: 'Boolean literal'},
  null: {kind: 'keyword', detail: 'Null literal'},
  undefined: {kind: 'keyword', detail: 'ExtendScript global value'}
};

function getLanguageCompletions() {
  return LANGUAGE_COMPLETIONS;
}

module.exports = {
  getLanguageCompletions
};
