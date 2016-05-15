require('./styles/reset.css');

const React = require('react');
const ReactDOM = require('react-dom');

const App = require('./components').default;

ReactDOM.render(<App />, document.getElementById('root'));
