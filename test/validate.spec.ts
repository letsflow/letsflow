import {validate} from '../src';
import {expect} from 'chai';

describe('validate', () => {
    describe('validate scenario', () => {
        it('should succeed with a minimal scenario', () => {
            const scenario = {
                title: 'minimal scenario',
                actions: {
                    complete: {},
                },
                states: {
                    initial: {
                        on: 'complete',
                        goto: '(done)',
                    },
                },
            };

            const result = validate(scenario);

            expect(validate.errors).to.eq(null);
            expect(result).to.be.true;
        });

        it('show fail if title is missing', () => {
            const scenario = {
                actions: {
                    complete: {},
                },
                states: {
                    initial: {
                        on: 'complete',
                        goto: '(done)',
                    },
                },
            };

            const result = validate(scenario);

            expect(result).to.be.false;
            expect(validate.errors).to.deep.contain({
                instancePath: '',
                keyword: 'required',
                message: "must have required property 'title'",
                params: {
                    missingProperty: 'title',
                },
                schemaPath: '#/required'
            });
        });
    });

    describe('validate actors', () => {
        it('should succeed with an actor with schema properties', () => {
            const scenario = {
                title: '',
                actors: {
                    user: {
                        properties: {
                            name: {
                                type: 'string'
                            },
                            favorites: {
                                type: 'array',
                                items: {
                                    type: 'string'
                                }
                            }
                        }
                    },
                },
                actions: {
                    complete: {},
                },
                states: {
                    initial: {on: 'complete', goto: '(done)'},
                },
            };

            const result = validate(scenario);

            expect(validate.errors).to.eq(null);
            expect(result).to.be.true;
        });

        it('should succeed with an actor with simple properties', () => {
            const scenario = {
                title: '',
                actors: {
                    user: {
                        properties: {
                            name: 'string',
                            address: {
                                street: 'string',
                                number: 'integer'
                            }
                        }
                    },
                },
                actions: {
                    complete: {},
                },
                states: {
                    initial: {on: 'complete', goto: '(done)'},
                },
            };

            const result = validate(scenario);

            expect(validate.errors).to.eq(null);
            expect(result).to.be.true;
        });

        it('should fail for an actor of an incorrect type', () => {
            const scenario = {
                title: '',
                actors: {
                    user: {type: 'string'}
                },
                actions: {
                    complete: {},
                },
                states: {
                    initial: {on: 'complete', goto: '(done)'},
                },
            };

            const result = validate(scenario);

            expect(result).to.be.false;
            expect(validate.errors).to.be.deep.contain({
                instancePath: '/actors/user/type',
                keyword: 'enum',
                message: 'must be equal to one of the allowed values',
                params: {allowedValues: ['object']},
                schemaPath: '#/oneOf/0/allOf/1/properties/type/enum'
            });
        });

        it('should succeed with a ref to a schema', () => {
            const scenario = {
                title: '',
                actors: {
                    user: {
                        title: 'User',
                        '$ref': 'https://example.com/schemas/person'
                    }
                },
                actions: {
                    complete: {},
                },
                states: {
                    initial: {on: 'complete', goto: '(done)'},
                },
            };

            const result = validate(scenario);

            expect(validate.errors).to.eq(null);
            expect(result).to.be.true;
        });
    });

    describe('validate actions', () => {
        it('should succeed with a standard action', () => {
            const scenario = {
                title: '',
                actions: {
                    complete: {
                        title: 'Complete',
                        description: 'Complete the process',
                        actor: 'user',
                        responses: {
                            one: {title: 'one'},
                            two: {title: 'two', update: [{select: 'assets.reason'}]},
                            three: {
                                title: 'two',
                                update: {
                                    select: 'assets.reason',
                                    data: {'<eval>': 'response | { message, code }'},
                                    patch: true,
                                    if: {'<eval>': "response.types.state | contains(@, 'WA')"}
                                }
                            }
                        },
                    }
                },
                states: {
                    initial: {on: 'complete', goto: '(done)'},
                },
            };

            const result = validate(scenario);

            expect(validate.errors).to.eq(null);
            expect(result).to.be.true;
        });

        it('should fail if update instruction is missing select', () => {
            const scenario = {
                title: '',
                actions: {
                    complete: {
                        update: {
                            data: 'foo'
                        }
                    }
                },
                states: {
                    initial: {on: 'complete', goto: '(done)'},
                },
            };

            const result = validate(scenario);

            expect(result).to.be.false;
            expect(validate.errors).to.deep.contain({
                instancePath: '/actions/complete/update',
                keyword: 'required',
                message: "must have required property 'select'",
                params: {
                    missingProperty: 'select',
                },
                schemaPath: '#/required',
            });
        });
    });

    describe('validate states', () => {
        it('should succeed with a simple state', () => {
            const scenario = {
                title: '',
                actions: {
                    complete: {},
                },
                states: {
                    initial: {
                        on: 'complete',
                        goto: '(done)'
                    }
                },
            };

            const result = validate(scenario);

            expect(validate.errors).to.eq(null);
            expect(result).to.be.true;
        });

        it('should fail for a simple state with a condition', () => {
            const scenario = {
                title: '',
                actions: {
                    complete: {},
                },
                states: {
                    initial: {
                        on: 'complete',
                        goto: '(done)',
                        if: { '<eval>': true }
                    }
                },
            };

            const result = validate(scenario);

            expect(result).to.be.false;
            expect(validate.errors).to.deep.contain({
                instancePath: '/states/initial/if',
                keyword: 'type',
                message: 'must be null',
                params: {
                    type: 'null',
                },
                schemaPath: '#/oneOf/1/properties/if/type',
            });
        });
    });
});
