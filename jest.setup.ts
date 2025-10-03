import '@testing-library/jest-dom';

// Mock scrollIntoView for all tests
Element.prototype.scrollIntoView = jest.fn();
