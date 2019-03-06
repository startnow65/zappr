import sinon from 'sinon'
import { expect } from 'chai'
import { formatDate } from '../../common/debug'
import Approval from '../../server/checks/Approval'
import AuditService from '../../server/service/audit/AuditService'
import * as EVENTS from '../../server/model/GithubEvents'

const DEFAULT_REPO = {
  name: 'hello-world',
  full_name: 'mfellner/hello-world',
  owner: {
    login: 'mfellner'
  }
}
const TOKEN = 'abcd'
const DB_REPO_ID = 341
const ISSUE_PAYLOAD = {
  action: 'created',
  repository: DEFAULT_REPO,
  issue: {
    number: 2
  },
  comment: {
    user: {
      login: 'mickeymouse'
    }
  }
}
const CLOSED_PR = {
  number: 3,
  state: 'closed'
}
const PR_PAYLOAD = {
  action: 'synchronize',
  number: 1,
  repository: DEFAULT_REPO,
  pull_request: {
    number: 1,
    updated_at: '2016-03-02T13:37:00Z',
    state: 'open',
    user: {login: 'stranger'},
    head: {
      sha: 'abcd1234'
    }
  }
}
const MERGED_PR_PAYLOAD = require('../fixtures/webhook.pull_request.merge.json')
const MALICIOUS_PAYLOAD = {
  action: 'edited', // or 'deleted'
  repository: DEFAULT_REPO,
  issue: {
    number: 1
  },
  changes: {
    body: {
      from: ':-1:'
    }
  },
  comment: {
    id: 1,
    body: ':+1:',
    created_at: '2016-08-15T13:03:28Z',
    user: {
      login: 'mfellner'
    }
  },
  sender: {
    login: 'prayerslayer'
  }
}
const REGULAR_ISSUE_PAYLOAD = {
  action: 'edited', // or 'deleted'
  repository: DEFAULT_REPO,
  issue: {
    number: 1
  },
  changes: {
    body: {
      from: ':-1:'
    }
  },
  comment: {
    id: 1,
    body: ':+1:',
    created_at: '2016-08-15T13:03:28Z',
    user: {
      login: 'prayerslayer'
    }
  },
  sender: {
    login: 'prayerslayer'
  }
}
const PR_COMMENT_PAYLOAD = {
  action: 'created',
  repository: DEFAULT_REPO,
  issue: {
    number: 1
  },
  comment: {
    id: 2,
    body: ':+1:',
    created_at: '2016-08-15T13:03:28Z',
    updated_at: '2016-08-15T13:03:28Z',
    user: {
      login: 'bar'
    }
  }
}
const PR_LABEL_PAYLOAD = Object.assign({}, PR_PAYLOAD, {action: 'labeled'})
const PR_UNLABEL_PAYLOAD = Object.assign({}, PR_PAYLOAD, {action: 'unlabeled'})
const DEFAULT_CONFIG = {
  approvals: {
    minimum: 2,
    ignore: 'none',
    pattern: '^:\\+1:$',
    veto: {
      pattern: '^:\\-1:$',
    }
  }
}
const CONFIG_APPROVAL_GROUPS = {
  foo: {
    minimum: 1,
    from: {
      users: ['foo', 'mr-foo']
    },
    badge: {
      approve: 'fooapprovebadge',
      veto: 'foovetobadge'
    }
  },
  bar: {
    minimum: 1,
    from: {
      users: ['bar', 'baz']
    },
    badge: {
      approve: 'barapprovebadge',
      veto: 'barvetobadge'
    }
  },
  bar2: {
    minimum: 1,
    from: {
      users: ['bar', 'baz']
    },
    badge: {
      approve: 'barapprovebadge',
      veto: 'barvetobadge'
    }
  },
  baz: {
    minimum: 0,
    from: {
      users: ['baz']
    },
    badge: {
      approve: 'bazapprovebadge',
      veto: 'bazvetobadge'
    }
  }
}
const LABEL_TEST_GROUP = {
  baz: {
    minimum: 1,
    from: {
      users: ['faz']
    }
  }
}
const INCLUDE_LABEL_CONDITIONS_CONFIG = {
  approvals: Object.assign({}, DEFAULT_CONFIG.approvals, {groups: Object.assign({}, CONFIG_APPROVAL_GROUPS, {baz: Object.assign({}, LABEL_TEST_GROUP.baz, 
    {
      conditions: {
        labels: {
          include: ['goodlabel']
        }
      }
    })})
  })
}
const EXCLUDE_LABEL_CONDITIONS_CONFIG = {
  approvals: Object.assign({}, DEFAULT_CONFIG.approvals, {groups: Object.assign({}, CONFIG_APPROVAL_GROUPS, {baz: Object.assign({}, LABEL_TEST_GROUP.baz, 
    {
      conditions: {
        labels: {
          exclude: ['badlabel']
        }
      }
    })})
  })
}
const LABEL_CONDITIONS_READY_CONFIG = {
  approvals: Object.assign({}, DEFAULT_CONFIG.approvals, {groups: Object.assign({}, CONFIG_APPROVAL_GROUPS, {baz: Object.assign({}, LABEL_TEST_GROUP.baz, 
    {
      conditions: {
        labels: {
          include: ['goodlabel'],
          exclude: ['badlabel']
        }
      }
    })})
  })
}
const BADGE_READY_CONFIG = {
  approvals: {
    minimum: 2,
    ignore: 'none',
    pattern: '^:\\+1:$',
    veto: {
      pattern: '^:\\-1:$',
    },
    groups: CONFIG_APPROVAL_GROUPS
  }
}
const BOT_USER_CONFIG = { approvals: Object.assign({}, DEFAULT_CONFIG.approvals,
  {
    bot_user_pattern: '(\\[bot\\]$|-robot$)'
  })}
  const INCLUDE_FILE_CONDITIONS_CONFIG = {
    approvals: Object.assign({}, BADGE_READY_CONFIG.approvals, {groups: Object.assign({}, CONFIG_APPROVAL_GROUPS, {baz: Object.assign({}, LABEL_TEST_GROUP.baz, 
      {
        conditions: {
          files: {
            include: ['*.foo', '.foo.bar', 'foo.bar']
          }
        }
      })})
    })
  }
  const EXCLUDE_FILE_CONDITIONS_CONFIG = {
    approvals: Object.assign({}, BADGE_READY_CONFIG.approvals, {groups: Object.assign({}, CONFIG_APPROVAL_GROUPS, {baz: Object.assign({}, LABEL_TEST_GROUP.baz, 
      {
        conditions: {
          files: {
            exclude: ['*.foo', '.foo.bar', 'foo.bar']
          }
        }
      })})
    })
  }
  const FILE_AND_LABEL_CONDITIONS_CONFIG = {
    approvals: Object.assign({}, INCLUDE_LABEL_CONDITIONS_CONFIG.approvals, {groups: Object.assign({}, CONFIG_APPROVAL_GROUPS, {baz: Object.assign({}, LABEL_TEST_GROUP.baz, 
      {
        conditions: {
          labels: {
            include: ['goodlabel']
          },
          files: {
            include: ['*.foo', '.foo.bar', 'foo.bar']
          }
        }
      })})
    })
  }
  const SUCCESS_STATUS = Approval.generateStatus({
  approvals: {total: ['foo', 'bar']},
  vetos: []
}, DEFAULT_CONFIG.approvals)
const MISSING_APPROVAL_GROUP_STATUS = Approval.generateStatus({
  approvals: {total: ['foo', 'bar'], groups: { foo: [1], bar: [2], baz: [] }},
  vetos: []
}, LABEL_CONDITIONS_READY_CONFIG.approvals, ['goodlabel'])
const BLOCKED_BY_VETO_STATUS = Approval.generateStatus({
  approvals: {total: ['foo', 'bar']},
  vetos: ['mr-foo']
}, DEFAULT_CONFIG.approvals)
const PENDING_STATUS = {
  state: 'pending',
  description: 'Approval validation in progress.',
  context: 'zappr'
}
const ZERO_APPROVALS_STATUS = Approval.generateStatus({approvals: {total: []}, vetos: []}, DEFAULT_CONFIG.approvals)
const DB_PR = {
  last_push: new Date(),
  number: 3,
  id: 1415
}

describe('Approval#fetchIgnoredUsers', () => {
  let approval

  beforeEach(() => {
    approval = new Approval(null, null)
  })

  it('should not do anything if ignore is missing', async(done) => {
    try {
      const ignore = await approval.fetchIgnoredUsers(DEFAULT_REPO, PR_PAYLOAD.pull_request, {}, TOKEN)
      expect(ignore.length).to.equal(0)
      done()
    } catch (e) {
      done(e)
    }
  })
  it('should not do anything if ignore=none', async(done) => {
    try {
      const ignore = await approval.fetchIgnoredUsers(DEFAULT_REPO, PR_PAYLOAD.pull_request, {ignore: 'none'}, TOKEN)
      expect(ignore.length).to.equal(0)
      done()
    } catch (e) {
      done(e)
    }
  })
  it('should fetch last committer if ignore=last_committer', async(done) => {
    try {
      const lastCommitter = 'mark'
      const github = {
        fetchLastCommitter: sinon.stub().returns(lastCommitter)
      }
      const approval = new Approval(github, null)
      const ignore = await approval.fetchIgnoredUsers(DEFAULT_REPO, PR_PAYLOAD.pull_request, {ignore: 'last_committer'}, TOKEN)
      expect(ignore.length).to.equal(1)
      expect(ignore[0]).to.equal(lastCommitter)
      done()
    } catch (e) {
      done(e)
    }
  })
  it('should return pr opener if ignore=pr_opener', async(done) => {
    try {
      const prOpener = PR_PAYLOAD.pull_request.user.login
      const ignore = await approval.fetchIgnoredUsers(DEFAULT_REPO, PR_PAYLOAD.pull_request, {ignore: 'pr_opener'}, TOKEN)
      expect(ignore.length).to.equal(1)
      expect(ignore[0]).to.equal(prOpener)
      done()
    } catch (e) {
      done(e)
    }
  })
  it('should return both if ignore=both', async(done) => {
    try {
      const lastCommitter = 'mark'
      const prOpener = PR_PAYLOAD.pull_request.user.login
      const github = {
        fetchLastCommitter: sinon.stub().returns(lastCommitter)
      }
      const approval = new Approval(github, null)
      const ignore = await approval.fetchIgnoredUsers(DEFAULT_REPO, PR_PAYLOAD.pull_request, {ignore: 'both'}, TOKEN)
      expect(ignore.length).to.equal(2)
      expect(ignore[0]).to.equal(lastCommitter)
      expect(ignore[1]).to.equal(prOpener)
      done()
    } catch (e) {
      done(e)
    }
  })
})

describe('Approval#generateStatus', () => {
  it('should favor vetos over approvals', () => {
    const result = Approval.generateStatus({approvals: {total: ['mr-foo']}, vetos: ['mr-bar']}, {minimum: 1})
    expect(result.state).to.equal('failure')
  })
  it('should be successful without vetos', () => {
    const result = Approval.generateStatus({approvals: {total: ['mr-foo']}, vetos: []}, {minimum: 1})
    expect(result.state).to.equal('success')
  })
})

describe('Approval#fetchCountApprovalsAndVetos', () => {
  const comments = [{
    id: 2,
    body: 'this loses'
  }, {
    id: 3,
    body: 'foo'
  }]
  const frozenComments = [{
    id: 1,
    body: 'bar'
  }, {
    id: 2,
    body: 'this wins'
  }]

  it('should properly merge frozen comments', async(done) => {
    try {
      const approval = new Approval({getComments: sinon.stub().returns(comments)}, null)
      approval.countApprovalsAndVetos = sinon.stub()
      // repository, pull_request, last_push, frozenComments, config, token
      await approval.fetchAndCountApprovalsAndVetos(DEFAULT_REPO, PR_PAYLOAD.pull_request, DB_PR.last_push, frozenComments, DEFAULT_CONFIG, TOKEN)
      expect(approval.countApprovalsAndVetos.called).to.be.true
      expect(approval.countApprovalsAndVetos.args[0][2]).to.deep.equal([
        frozenComments[0],
        frozenComments[1],
        comments[1]
      ])
      done()
    } catch (e) {
      done(e)
    }
  })
})

describe('Approval#countApprovalsAndVetos', () => {
  const comments = [{
    user: 'prayerslayer',
    id: 1,
    body: 'awesome :+1:'
  }, {
    user: 'mfellner',
    id: 2,
    body: ':+1:'
  }, {
    user: 'mfellner',
    id: 3,
    body: ':+1:'
  }]

  it('should honor the provided pattern', async(done) => {
    try {
      const approval = new Approval(null, null)
      const {approvals} = await approval.countApprovalsAndVetos(DEFAULT_REPO, {}, comments, DEFAULT_CONFIG.approvals)
      expect(approvals).to.deep.equal({total: ['mfellner'], processed: [2]})
      done()
    } catch (e) {
      done(e)
    }
  })
})

describe('Approval#getCommentStatsForConfig', () => {
  let github, approval

  beforeEach(() => {
    github = {
      isMemberOfOrg: () => {
      },
      isCollaborator: () => {
      }
    }
    approval = new Approval(github, null)
  })

  it('should sum the total correctly', async(done) => {
    try {
      let comments = [{
        body: 'awesome',
        user: 'user1'
      }, {
        body: 'awesome',
        user: 'user2'
      }, {
        body: 'lolz',
        user: 'user3'
      }]
      let approvals = await approval.getCommentStatsForConfig(DEFAULT_REPO, comments, DEFAULT_CONFIG.approvals, TOKEN)
      expect(approvals.total).to.deep.equal(['user1', 'user2', 'user3'])
      // and with empty comments
      comments = []
      approvals = await approval.getCommentStatsForConfig(DEFAULT_REPO, comments, DEFAULT_CONFIG.approvals, TOKEN)
      expect(approvals.total).to.deep.equal([])
      done()
    } catch (e) {
      done(e)
    }
  })
  it('should honor from configuration', async(done) => {
    try {
      const comments = [{
        body: 'awesome',
        user: 'user1'
      }, {
        body: 'awesome',
        user: 'user2'
      }, {
        body: 'lolz',
        user: 'user3'
      }]
      sinon.stub(github, 'isMemberOfOrg', (org, user) => user === 'user3')
      const config = Object.assign({}, DEFAULT_CONFIG.approvals, {from: {orgs: ['zalando']}})
      const approvals = await approval.getCommentStatsForConfig(DEFAULT_REPO, comments, config, TOKEN)
      expect(github.isMemberOfOrg.callCount).to.equal(3)
      expect(approvals.total).to.deep.equal(['user3'])
      done()
    } catch (e) {
      done(e)
    }
  })
  it('should contain group information', async(done) => {
    try {
      const comments = [{
        body: 'awesome',
        user: 'user1'
      }, {
        body: 'awesome',
        user: 'user2'
      }, {
        body: 'lolz',
        user: 'user3'
      }]
      github.isMemberOfOrg = sinon.stub().returns(true)
      const config = Object.assign({}, DEFAULT_CONFIG.approvals, {
          groups: {
            zalando: {
              minimum: 2,
              from: {
                orgs: ['zalando']
              }
            }
          }
        }
      )
      const approvals = await approval.getCommentStatsForConfig(DEFAULT_REPO, comments, config, TOKEN)
      expect(github.isMemberOfOrg.callCount).to.equal(3)
      expect(approvals.total).to.deep.equal(['user1', 'user2', 'user3'])
      expect(approvals.groups.zalando).to.be.defined
      expect(approvals.groups.zalando).to.deep.equal(['user1', 'user2', 'user3'])
      done()
    }
    catch
      (e) {
      done(e)
    }
  })
})

describe('Approval#execute', () => {
  let github, pullRequestHandler, approval, auditService


  beforeEach(() => {
    pullRequestHandler = {
      onGet: sinon.stub().returns(DB_PR),
      onAddCommit: sinon.spy(),
      onCreatePullRequest: sinon.spy(),
      onDeletePullRequest: sinon.spy(),
      onGetFrozenComments: sinon.stub().returns([]),
      onRemoveFrozenComments: sinon.stub(),
      onAddFrozenComment: sinon.stub()
    }
    github = {
      isMemberOfOrg: sinon.spy(),
      isCollaborator: sinon.spy(),
      setCommitStatus: sinon.spy(),
      getApprovals: sinon.spy(),
      getPullRequest: sinon.spy(),
      getComments: sinon.spy(),
      fetchPullRequestCommits: sinon.spy(),
      getIssueLabels: sinon.spy(),
      getPullRequestFiles: sinon.stub().returns([])
    }
    auditService = sinon.createStubInstance(AuditService)
    approval = new Approval(github, pullRequestHandler, auditService)
  })

  const SKIP_ACTIONS = ['assigned', 'unassigned', 'closed']

  SKIP_ACTIONS.forEach(action=> {
    it(`should do nothing on "${action}"`, async(done) => {
      try {
        await approval.execute(DEFAULT_CONFIG, EVENTS.PULL_REQUEST, Object.assign(PR_PAYLOAD, {action}), TOKEN, DB_REPO_ID)
        expect(github.setCommitStatus.callCount).to.equal(0)
        expect(github.getApprovals.callCount).to.equal(0)
        done()
      } catch (e) {
        done(e)
      }
    })
  })

  it('should set status to failure on last issue comment when there is a veto comment', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }, {
      body: ':+1:',
      user: 'bar',
      id: 3
    }, {
      body: ':-1:',
      user: 'mr-foo',
      id: 4
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    try {
      await approval.execute(DEFAULT_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getComments.callCount).to.equal(1)
      expect(github.getPullRequest.callCount).to.equal(1)
      expect(github.isMemberOfOrg.callCount).to.equal(0)
      expect(auditService.log.callCount).to.equal(1)

      const failureStatusCallArgs = github.setCommitStatus.args[1]
      const commentCallArgs = github.getComments.args[0]
      const prCallArgs = github.getPullRequest.args[0]

      expect(prCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        2,
        TOKEN
      ])
      expect(commentCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        1,
        formatDate(DB_PR.last_push),
        TOKEN
      ])
      expect(failureStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        BLOCKED_BY_VETO_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should set status to success on last issue comment', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }, {
      body: ':+1:',
      user: 'bar',
      id: 3
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    try {
      await approval.execute(DEFAULT_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getComments.callCount).to.equal(1)
      expect(github.getPullRequest.callCount).to.equal(1)
      expect(github.isMemberOfOrg.callCount).to.equal(0)
      expect(auditService.log.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      const commentCallArgs = github.getComments.args[0]
      const prCallArgs = github.getPullRequest.args[0]

      expect(prCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        2,
        TOKEN
      ])
      expect(commentCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        1,
        formatDate(DB_PR.last_push),
        TOKEN
      ])
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        SUCCESS_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should set ignore robot users comments', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'bar',
      id: 1
    },  {
      body: ':+1:',
      user: 'bar-robot',
      id: 3
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    try {
      await approval.execute(DEFAULT_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getComments.callCount).to.equal(1)
      expect(github.getPullRequest.callCount).to.equal(1)
      expect(github.isMemberOfOrg.callCount).to.equal(0)
      expect(auditService.log.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      const commentCallArgs = github.getComments.args[0]
      const prCallArgs = github.getPullRequest.args[0]

      expect(prCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        2,
        TOKEN
      ])
      expect(commentCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        1,
        formatDate(DB_PR.last_push),
        TOKEN
      ])
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        {
          "context": "zappr",
          "description": "This PR needs 1 more approvals (1/2 given).",
          "state": "pending",
        },
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should do nothing on comment on non-open pull_request', async(done) => {
    github.getPullRequest = sinon.stub().returns(CLOSED_PR)
    await approval.execute(DEFAULT_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)
    expect(github.setCommitStatus.callCount).to.equal(0)
    expect(github.getApprovals.callCount).to.equal(0)
    expect(auditService.log.called).to.be.false
    done()
  })

  it('should set status to pending on PR:opened', async(done) => {
    PR_PAYLOAD.action = 'opened'
    try {
      await approval.execute(DEFAULT_CONFIG, EVENTS.PULL_REQUEST, PR_PAYLOAD, TOKEN, DB_REPO_ID)
      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getComments.callCount).to.equal(0)
      expect(auditService.log.callCount).to.equal(1)

      const pendingCallArgs = github.setCommitStatus.args[0]
      const missingApprovalsCallArgs = github.setCommitStatus.args[1]

      expect(pendingCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        PR_PAYLOAD.pull_request.head.sha,
        PENDING_STATUS,
        TOKEN
      ])
      expect(missingApprovalsCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        PR_PAYLOAD.pull_request.head.sha,
        ZERO_APPROVALS_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should set status to success on PR:reopened with all approvals', async(done) => {
    try {
      PR_PAYLOAD.action = 'reopened'
      github.fetchPullRequestCommits = sinon.stub().returns([])
      github.getComments = sinon.stub().returns([])
      approval.countApprovalsAndVetos = sinon.stub().returns({
        approvals: {total: ['red', 'blue', 'green', 'yellow']},
        vetos: {total: []},
        processed: []
      })
      await approval.execute(DEFAULT_CONFIG, EVENTS.PULL_REQUEST, PR_PAYLOAD, TOKEN, DB_REPO_ID)
      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getComments.callCount).to.equal(1)
      expect(auditService.log.callCount).to.equal(1)

      const pendingCallArgs = github.setCommitStatus.args[0]
      const successCallArgs = github.setCommitStatus.args[1]


      expect(pendingCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        PR_PAYLOAD.pull_request.head.sha,
        PENDING_STATUS,
        TOKEN
      ])
      expect(successCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        PR_PAYLOAD.pull_request.head.sha,
        Approval.generateStatus({approvals: {total: ['red', 'blue', 'green', 'yellow']}, vetos: []}, {minimum: 2}),
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should set status to pending on PR:synchronize', async(done) => {
    try {
      const payload = Object.assign({}, PR_PAYLOAD, {action: 'synchronize'})
      await approval.execute(DEFAULT_CONFIG, EVENTS.PULL_REQUEST, payload, TOKEN, DB_REPO_ID)
      expect(pullRequestHandler.onRemoveFrozenComments.calledWith(DB_PR.id)).to.be.true
      expect(pullRequestHandler.onAddCommit.calledWith(DB_REPO_ID, payload.number)).to.be.true
      expect(github.setCommitStatus.callCount).to.equal(1)
      expect(github.setCommitStatus.args[0]).to.deep.equal([
        'mfellner',
        'hello-world',
        PR_PAYLOAD.pull_request.head.sha,
        ZERO_APPROVALS_STATUS,
        TOKEN
      ])
      expect(auditService.log.callCount).to.equal(1)
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should set status to error when auditService.log throws', async(done) => {
    try {
      PR_PAYLOAD.action = 'synchronize'
      auditService.log = sinon.stub().throws(new Error('Audit API Error'))
      await approval.execute(DEFAULT_CONFIG, EVENTS.PULL_REQUEST, PR_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.setCommitStatus.args[1][3].state).to.equal('error')
      expect(github.setCommitStatus.args[1][3].description).to.equal('Audit API Error')
      done()
    } catch (e) {
      done(e)
    }
  })

  const TRIGGER_ISSUE_ACTIONS = ['edited', 'deleted']
  TRIGGER_ISSUE_ACTIONS.forEach(action => {
    it(`should detect a maliciously ${action} comment and freeze it`, async(done) => {
      try {
        const payload = Object.assign({}, MALICIOUS_PAYLOAD, {action})
        github.getPullRequest = sinon.stub()
                                     .withArgs(DEFAULT_REPO.owner.login, DEFAULT_REPO.name, payload.issue.number, TOKEN)
                                     .returns(PR_PAYLOAD.pull_request)
        pullRequestHandler.getOrCreateDbPullRequest = sinon.stub()
                                                           .withArgs(DB_REPO_ID, payload.issue.number)
                                                           .returns(DB_PR)
        github.getComments = sinon.stub().returns([]) // does not matter for this test
        await approval.execute(DEFAULT_CONFIG, EVENTS.ISSUE_COMMENT, payload, TOKEN, DB_REPO_ID)
        expect(pullRequestHandler.onRemoveFrozenComments.called).to.be.false
        expect(pullRequestHandler.onGetFrozenComments.calledOnce).to.be.true
        expect(pullRequestHandler.onGetFrozenComments.calledWith(DB_PR.id, DB_PR.last_push)).to.be.true
        expect(pullRequestHandler.onAddFrozenComment.calledOnce).to.be.true
        const expectedFrozenComment = {
          id: payload.comment.id,
          body: action === 'edited' ? payload.changes.body.from : payload.comment.body,
          created_at: payload.comment.created_at,
          user: payload.comment.user.login
        }
        expect(pullRequestHandler.onAddFrozenComment.args[0]).to.deep.equal([DB_PR.id, expectedFrozenComment])
        done()
      } catch (e) {
        done(e)
      }
    })

    it(`should not freeze comments that were ${action} by the author`, async(done) => {
      try {
        const payload = Object.assign({}, REGULAR_ISSUE_PAYLOAD, {action})
        github.getPullRequest = sinon.stub()
                                     .withArgs(DEFAULT_REPO.owner.login, DEFAULT_REPO.name, payload.issue.number, TOKEN)
                                     .returns(PR_PAYLOAD.pull_request)
        pullRequestHandler.getOrCreateDbPullRequest = sinon.stub()
                                                           .withArgs(DB_REPO_ID, payload.issue.number)
                                                           .returns(DB_PR)
        github.getComments = sinon.stub().returns([]) // does not matter for this test
        await approval.execute(DEFAULT_CONFIG, EVENTS.ISSUE_COMMENT, payload, TOKEN, DB_REPO_ID)
        expect(pullRequestHandler.onRemoveFrozenComments.called).to.be.false
        expect(pullRequestHandler.onGetFrozenComments.calledOnce).to.be.true
        expect(pullRequestHandler.onGetFrozenComments.calledWith(DB_PR.id, DB_PR.last_push)).to.be.true
        expect(pullRequestHandler.onAddFrozenComment.calledOnce).to.be.false
        done()
      } catch (e) {
        done(e)
      }
    })

    it(`should not try to freeze already frozen comments`, async(done) => {
      try {
        const payload = Object.assign({}, MALICIOUS_PAYLOAD, {action})
        // frozen comments already contain the one edited
        const frozen_comments = [{
          id: payload.comment.id,
          body: action === 'edited' ? payload.changes.body.from : payload.comment.body,
          created_at: payload.comment.created_at,
          user: payload.comment.user.login
        }]
        github.getPullRequest = sinon.stub()
                                     .withArgs(DEFAULT_REPO.owner.login, DEFAULT_REPO.name, payload.issue.number, TOKEN)
                                     .returns(PR_PAYLOAD.pull_request)
        pullRequestHandler.getOrCreateDbPullRequest = sinon.stub()
                                                           .withArgs(DB_REPO_ID, payload.issue.number)
                                                           .returns(DB_PR)
        pullRequestHandler.onGetFrozenComments = sinon.stub()
                                                      .withArgs(DB_PR.id, DB_PR.last_push)
                                                      .returns(frozen_comments)
        github.getComments = sinon.stub().returns([]) // does not matter for this test
        await approval.execute(DEFAULT_CONFIG, EVENTS.ISSUE_COMMENT, payload, TOKEN, DB_REPO_ID)
        expect(pullRequestHandler.onRemoveFrozenComments.called).to.be.false
        expect(pullRequestHandler.onAddFrozenComment.calledOnce).to.be.false
        done()
      } catch (e) {
        done(e)
      }
    })

    it(`should not take into account ${action} by another user outdated comment`, async(done) => {
      try {
        const pullRequestNumber = 123

        const pullRequest = {
          number: pullRequestNumber,
          updated_at: '2016-03-02T13:37:00Z',
          state: 'open',
          user: {
            login: 'stranger'
          },
          head: {
            sha: 'abcd1234'
          }
        }

        const openPullRequestWebhook = {
          action: 'opened',
          number: pullRequestNumber,
          repository: DEFAULT_REPO,
          pull_request: {
            number: pullRequestNumber,
            updated_at: '2016-03-02T13:37:00Z',
            state: 'open',
            user: {
              login: 'stranger'
            },
            head: {
              sha: 'abcd1234'
            }
          }
        }

        const synchronizePullRequestWebhook = Object.assign({}, openPullRequestWebhook, {
          action: 'synchronize'
        })

        const commentWebhook = {
          action: 'created',
          repository: DEFAULT_REPO,
          issue: {
            number: pullRequestNumber
          },
          comment: {
            id: 1,
            user: {
              login: 'bar'
            }
          }
        }

        const commentModificationWebhook = {
          action: action,
          repository: DEFAULT_REPO,
          issue: {
            number: pullRequestNumber
          },
          changes: {
            body: {
              from: ':+1:'
            }
          },
          comment: {
            id: 1,
            body: ':+1: :+1:',
            created_at: '2016-08-15T13:03:28Z',
            user: {
              login: 'bar'
            }
          },
          sender: {
            login: 'foo'
          }
        }

        github.getPullRequest = sinon.stub()
          .withArgs(DEFAULT_REPO.owner.login, DEFAULT_REPO.name, pullRequestNumber, TOKEN)
          .returns(pullRequest)
        pullRequestHandler.getOrCreateDbPullRequest = sinon.stub()
          .withArgs(DB_REPO_ID, pullRequestNumber)
          .returns(DB_PR)

        await approval.execute(DEFAULT_CONFIG, EVENTS.PULL_REQUEST, openPullRequestWebhook, TOKEN, DB_REPO_ID)
        expect(github.setCommitStatus.callCount).to.equal(2)
        expect(github.setCommitStatus.args[1][3].state).to.equal('pending')
        expect(github.setCommitStatus.args[1][3].description).to.equal('This PR needs 2 more approvals (0/2 given).')

        github.setCommitStatus = sinon.spy()

        github.getComments = sinon.stub()
          .returns([{
            id: 1,
            body: ':+1:',
            user: 'bar'
          }])

        await approval.execute(DEFAULT_CONFIG, EVENTS.ISSUE_COMMENT, commentWebhook, TOKEN, DB_REPO_ID)

        expect(github.setCommitStatus.callCount).to.equal(2)
        expect(github.setCommitStatus.args[1][3].state).to.equal('pending')
        expect(github.setCommitStatus.args[1][3].description).to.equal('This PR needs 1 more approvals (1/2 given).')

        github.setCommitStatus = sinon.spy()

        await approval.execute(DEFAULT_CONFIG, EVENTS.PULL_REQUEST, synchronizePullRequestWebhook, TOKEN, DB_REPO_ID)

        expect(github.setCommitStatus.callCount).to.equal(1)
        expect(github.setCommitStatus.args[0][3].state).to.equal('pending')
        expect(github.setCommitStatus.args[0][3].description).to.equal('This PR needs 2 more approvals (0/2 given).')

        github.setCommitStatus = sinon.spy()

        github.getComments = sinon.stub()
          .returns([{
            id: 2,
            body: ':+1:',
            user: 'foo'
          }])

        await approval.execute(DEFAULT_CONFIG, EVENTS.ISSUE_COMMENT, commentWebhook, TOKEN, DB_REPO_ID)

        expect(github.setCommitStatus.callCount).to.equal(2)
        expect(github.setCommitStatus.args[1][3].state).to.equal('pending')
        expect(github.setCommitStatus.args[1][3].description).to.equal('This PR needs 1 more approvals (1/2 given).')

        github.setCommitStatus = sinon.spy()

        github.getComments = sinon.stub()
          .returns([{
            id: 2,
            body: ':+1:',
            user: 'foo'
          }])

        await approval.execute(DEFAULT_CONFIG, EVENTS.ISSUE_COMMENT, commentModificationWebhook, TOKEN, DB_REPO_ID)

        expect(github.setCommitStatus.callCount).to.equal(2)
        expect(github.setCommitStatus.args[1][3].state).to.equal('pending')
        expect(github.setCommitStatus.args[1][3].description).to.equal('This PR needs 1 more approvals (1/2 given).')

        done()
      } catch (e) {
        done(e)
      }
    })
  })

  it('should not freeze newly created comments', async(done) => {
    try {
      const payload = Object.assign({}, MALICIOUS_PAYLOAD, {action: 'created'})
      github.getPullRequest = sinon.stub()
                                   .withArgs(DEFAULT_REPO.owner.login, DEFAULT_REPO.name, payload.issue.number, TOKEN)
                                   .returns(PR_PAYLOAD.pull_request)
      pullRequestHandler.getOrCreateDbPullRequest = sinon.stub()
                                                         .withArgs(DB_REPO_ID, payload.issue.number)
                                                         .returns(DB_PR)
      github.getComments = sinon.stub().returns([]) // does not matter for this test
      await approval.execute(DEFAULT_CONFIG, EVENTS.ISSUE_COMMENT, payload, TOKEN, DB_REPO_ID)
      expect(pullRequestHandler.onRemoveFrozenComments.called).to.be.false
      expect(pullRequestHandler.onGetFrozenComments.calledOnce).to.be.true
      expect(pullRequestHandler.onGetFrozenComments.calledWith(DB_PR.id, DB_PR.last_push)).to.be.true
      expect(pullRequestHandler.onAddFrozenComment.called).to.be.false
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should merge frozen comments back in upstream comments', async(done) => {
    try {
      github.getPullRequest = sinon.stub()
                                   .withArgs(DEFAULT_REPO.owner.login, DEFAULT_REPO.name, MALICIOUS_PAYLOAD.issue.number, TOKEN)
                                   .returns(PR_PAYLOAD.pull_request)
      pullRequestHandler.getOrCreateDbPullRequest = sinon.stub()
                                                         .withArgs(DB_REPO_ID, MALICIOUS_PAYLOAD.issue.number)
                                                         .returns(DB_PR)
      const frozenComments = [{
        id: 1,
        body: ':-1:',
        user: 'foo'
      }, {
        id: 2,
        body: 'This does not look good.',
        user: 'bar'
      }]
      const upstreamComments = [{
        id: 2,
        body: ':+1:',
        user: 'bar'
      }, {
        id: 3,
        body: ':+1:',
        user: 'baz'
      }]
      pullRequestHandler.onGetFrozenComments = sinon.stub()
                                                    .withArgs(DB_PR.id, DB_PR.last_push)
                                                    .returns(frozenComments)
      github.getComments = sinon.stub()
                                .returns(upstreamComments)
      await approval.execute(DEFAULT_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)
      expect(pullRequestHandler.onGetFrozenComments.calledOnce).to.be.true
      expect(pullRequestHandler.onGetFrozenComments.calledWith(DB_PR.id, DB_PR.last_push)).to.be.true
      expect(pullRequestHandler.onAddFrozenComment.calledOnce).to.be.false
      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.setCommitStatus.args[1][3].state).to.equal('failure')
      expect(github.setCommitStatus.args[1][3].description).to.equal('Vetoes: @foo.')
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should log an audit event on pull request merge and delete the pull request from the db', async(done) => {
    try {
      await approval.execute(DEFAULT_CONFIG, EVENTS.PULL_REQUEST, MERGED_PR_PAYLOAD, null, null)
      expect(auditService.log.calledOnce).to.be.true
      expect(pullRequestHandler.onDeletePullRequest.calledOnce).to.be.true
      expect(github.setCommitStatus.called).to.be.false
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should not fetch PR labels if label based condition is not specified', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)

    try {
      await approval.execute(DEFAULT_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getIssueLabels.callCount).to.equal(0)
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should ignore approval group requirements if "includes" label based condition is not met', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getIssueLabels = sinon.stub().returns(['foolabel'])
    try {
      await approval.execute(INCLUDE_LABEL_CONDITIONS_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getIssueLabels.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        SUCCESS_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should apply approval group requirements if "includes" label based condition is met', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getIssueLabels = sinon.stub().returns(['goodlabel'])
    try {
      await approval.execute(INCLUDE_LABEL_CONDITIONS_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getIssueLabels.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        MISSING_APPROVAL_GROUP_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should ignore approval group requirements if "excludes" label based condition is not met', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getIssueLabels = sinon.stub().returns(['badlabel'])
    try {
      await approval.execute(EXCLUDE_LABEL_CONDITIONS_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getIssueLabels.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        SUCCESS_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should apply approval group requirements if "excludes" label based condition is met: different label', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getIssueLabels = sinon.stub().returns(['foolabel'])
    try {
      await approval.execute(EXCLUDE_LABEL_CONDITIONS_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getIssueLabels.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        MISSING_APPROVAL_GROUP_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should apply approval group requirements if "excludes" label based condition is met: no label', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getIssueLabels = sinon.stub().returns([])
    try {
      await approval.execute(EXCLUDE_LABEL_CONDITIONS_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getIssueLabels.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        MISSING_APPROVAL_GROUP_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('"excludes" label based conditions should have higher priority than "includes" conditions', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getIssueLabels = sinon.stub().returns(['goodlabel', 'badlabel'])
    try {
      await approval.execute(LABEL_CONDITIONS_READY_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getIssueLabels.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        SUCCESS_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('"includes": multiple label based conditions and issue labels should work', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getIssueLabels = sinon.stub().returns(['goodlabel', 'indifferentlabel'])
    try {
      await approval.execute(LABEL_CONDITIONS_READY_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getIssueLabels.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        MISSING_APPROVAL_GROUP_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('"excludes": multiple label based conditions and issue labels should work', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getIssueLabels = sinon.stub().returns(['badlabel', 'indifferentlabel'])
    try {
      await approval.execute(LABEL_CONDITIONS_READY_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getIssueLabels.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        SUCCESS_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should set commit status when label is added to PR', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getIssueLabels = sinon.stub().returns(['badlabel', 'indifferentlabel'])
    try {
      await approval.execute(LABEL_CONDITIONS_READY_CONFIG, EVENTS.PULL_REQUEST, PR_LABEL_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getIssueLabels.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        SUCCESS_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should set commit status when label is removed from PR', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getIssueLabels = sinon.stub().returns(['badlabel', 'indifferentlabel'])
    try {
      await approval.execute(LABEL_CONDITIONS_READY_CONFIG, EVENTS.PULL_REQUEST, PR_UNLABEL_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getIssueLabels.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        SUCCESS_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should not add comment badge if approval groups are not defined', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, Object.assign({}, PR_COMMENT_PAYLOAD.comment, {user: PR_COMMENT_PAYLOAD.comment.user.login})])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.setIssueCommentBody = sinon.spy()
    try {
      await approval.execute(DEFAULT_CONFIG, EVENTS.ISSUE_COMMENT, PR_COMMENT_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.setIssueCommentBody.callCount).to.equal(0)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        SUCCESS_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should not add comment badge if comment updated date is different from its created date. badge has been added already', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, Object.assign({}, PR_COMMENT_PAYLOAD.comment, {user: PR_COMMENT_PAYLOAD.comment.user.login})])
    
    let payload = Object.assign({}, PR_COMMENT_PAYLOAD, {comment: Object.assign({}, PR_COMMENT_PAYLOAD.comment, {updated_at: '2016-03-02T13:37:01Z'})})
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.setIssueCommentBody = sinon.spy()
    try {
      await approval.execute(BADGE_READY_CONFIG, EVENTS.ISSUE_COMMENT, payload, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.setIssueCommentBody.callCount).to.equal(0)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        SUCCESS_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should not add comment badge if approving user is not a member of any defined group', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, Object.assign({}, PR_COMMENT_PAYLOAD.comment, {user: PR_COMMENT_PAYLOAD.comment.user.login})])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.setIssueCommentBody = sinon.spy()
    const payload = Object.assign({}, PR_COMMENT_PAYLOAD, { comment: Object.assign({}, PR_COMMENT_PAYLOAD.comment, {user: {login: 'baz'}})})
    try {
      await approval.execute(BADGE_READY_CONFIG, EVENTS.ISSUE_COMMENT, payload, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.setIssueCommentBody.callCount).to.equal(0)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        SUCCESS_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('correct comment badge should be set: approve', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, Object.assign({}, PR_COMMENT_PAYLOAD.comment, {user: PR_COMMENT_PAYLOAD.comment.user.login})])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.setIssueCommentBody = sinon.spy()
    try {
      await approval.execute(BADGE_READY_CONFIG, EVENTS.ISSUE_COMMENT, PR_COMMENT_PAYLOAD, TOKEN, DB_REPO_ID)
      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.setIssueCommentBody.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        SUCCESS_STATUS,
        TOKEN
      ])
      expect(github.setIssueCommentBody.args[0][3]).to.equal(PR_COMMENT_PAYLOAD.comment.body + "\n\n![Approved with Zappr](" + BADGE_READY_CONFIG.approvals.groups['bar'].badge.approve + ") ")
      done()
    } catch (e) {
      done(e)
    }
  })

  it('correct comment badge should be set: approve (multiple badges)', async(done) => {
    const payload = Object.assign({}, PR_COMMENT_PAYLOAD, {comment: Object.assign({}, PR_COMMENT_PAYLOAD.comment, {user: {login: 'baz'}})})
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, Object.assign({}, payload.comment, {user: payload.comment.user.login})])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.setIssueCommentBody = sinon.spy()
    try {
      await approval.execute(BADGE_READY_CONFIG, EVENTS.ISSUE_COMMENT, payload, TOKEN, DB_REPO_ID)
      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.setIssueCommentBody.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        Object.assign({}, SUCCESS_STATUS, { "description": "Approvals: @foo, @baz." }),
        TOKEN
      ])
      expect(github.setIssueCommentBody.args[0][3]).to.equal(PR_COMMENT_PAYLOAD.comment.body + "\n\n![Approved with Zappr](" + BADGE_READY_CONFIG.approvals.groups['bar'].badge.approve + ")  ![Approved with Zappr](" + BADGE_READY_CONFIG.approvals.groups['baz'].badge.approve + ") ")
      done()
    } catch (e) {
      done(e)
    }
  })

  it('correct comment badge should be set: veto', async(done) => {
    const payload = Object.assign({}, PR_COMMENT_PAYLOAD, {comment: Object.assign({}, PR_COMMENT_PAYLOAD.comment, {body: ':-1:', user: {login: 'mr-foo'}})})
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, Object.assign({}, payload.comment, {user: payload.comment.user.login})])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.setIssueCommentBody = sinon.spy()

    try {
      await approval.execute(BADGE_READY_CONFIG, EVENTS.ISSUE_COMMENT, payload, TOKEN, DB_REPO_ID)
      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.setIssueCommentBody.callCount).to.equal(1)

      const failureStatusCallArgs = github.setCommitStatus.args[1]
      expect(failureStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        BLOCKED_BY_VETO_STATUS,
        TOKEN
      ])
      expect(github.setIssueCommentBody.args[0][3]).to.equal(payload.comment.body + "\n\n![Vetoed with Zappr](" + BADGE_READY_CONFIG.approvals.groups['foo'].badge.veto + ") ")
      done()
    } catch (e) {
      done(e)
    }
  })

  it('correct comment badge should be set: veto (multiple badges)', async(done) => {
    const payload = Object.assign({}, PR_COMMENT_PAYLOAD, {comment: Object.assign({}, PR_COMMENT_PAYLOAD.comment, {body: ':-1:', user: {login: 'baz'}})})
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, Object.assign({}, payload.comment, {user: payload.comment.user.login})])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.setIssueCommentBody = sinon.spy()

    try {
      await approval.execute(BADGE_READY_CONFIG, EVENTS.ISSUE_COMMENT, payload, TOKEN, DB_REPO_ID)
      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.setIssueCommentBody.callCount).to.equal(1)

      const failureStatusCallArgs = github.setCommitStatus.args[1]
      expect(failureStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        Object.assign({}, BLOCKED_BY_VETO_STATUS, { "description": "Vetoes: @baz." }),
        TOKEN
      ])
      expect(github.setIssueCommentBody.args[0][3]).to.equal(payload.comment.body + "\n\n![Vetoed with Zappr](" + BADGE_READY_CONFIG.approvals.groups['bar'].badge.veto + ")  ![Vetoed with Zappr](" + BADGE_READY_CONFIG.approvals.groups['baz'].badge.veto + ") ")
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should ignore comments from a user whose login matches bot user regex', async(done) => {
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    try {
      let commentWebhook = {
        action: 'created',
        repository: DEFAULT_REPO,
        issue: {
          number: 1
        },
        comment: {
          id: 1,
          user: {
            login: 'v-robot'
          }
        }
      }
      
      await approval.execute(BOT_USER_CONFIG, EVENTS.ISSUE_COMMENT, commentWebhook, TOKEN, DB_REPO_ID)
      expect(github.setCommitStatus.callCount).to.equal(0)
      
      commentWebhook.comment.user.login = 'codecov[bot]'
      await approval.execute(BOT_USER_CONFIG, EVENTS.ISSUE_COMMENT, commentWebhook, TOKEN, DB_REPO_ID)
      expect(github.setCommitStatus.callCount).to.equal(0)
      
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should process comments from a user whose login does not match bot user regex', async(done) => {
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    try {
      await approval.execute(BOT_USER_CONFIG, EVENTS.ISSUE_COMMENT, PR_COMMENT_PAYLOAD, TOKEN, DB_REPO_ID)
      expect(github.setCommitStatus.callCount).to.equal(2)
      
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should not fetch PR files if file based condition is not specified', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)

    try {
      await approval.execute(DEFAULT_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getPullRequestFiles.callCount).to.equal(0)
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should ignore approval group requirements if "includes" file based condition is not met', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getPullRequestFiles = sinon.stub().returns(['foo/dir/a.a', 'foo/dir/b.b', 'foo/dir/c.c'])

    try {
      await approval.execute(INCLUDE_FILE_CONDITIONS_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getPullRequestFiles.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        SUCCESS_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should apply approval group requirements if "includes" file based condition is met: matching file not in root dir', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getPullRequestFiles = sinon.stub().returns(['foo/dir/a.a', 'foo/dir/b.b', 'foo/dir/c.foo', 'foo/dir/d.d'])

    try {
      await approval.execute(INCLUDE_FILE_CONDITIONS_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getPullRequestFiles.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        MISSING_APPROVAL_GROUP_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should apply approval group requirements if "includes" file based condition is met: matching file in root dir', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getPullRequestFiles = sinon.stub().returns(['foo/dir/a.a', 'foo/dir/b.b', 'c.foo', 'foo/dir/d.d'])

    try {
      await approval.execute(INCLUDE_FILE_CONDITIONS_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getPullRequestFiles.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        MISSING_APPROVAL_GROUP_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should apply approval group requirements if "includes" file based condition is met: exact matching file name', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getPullRequestFiles = sinon.stub().returns(['foo/dir/a.a', 'foo/dir/b.b', '.foo.bar', 'foo/dir/d.d'])

    try {
      await approval.execute(INCLUDE_FILE_CONDITIONS_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getPullRequestFiles.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        MISSING_APPROVAL_GROUP_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should ignore approval group requirements if "excludes" file based condition is not met', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getPullRequestFiles = sinon.stub().returns(['foo/dir/a.a', 'foo/dir/b.b', 'foo/dir/c.foo', 'foo/dir/d.d'])

    try {
      await approval.execute(EXCLUDE_FILE_CONDITIONS_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getPullRequestFiles.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        SUCCESS_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should apply approval group requirements if "excludes" file based condition is met', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getPullRequestFiles = sinon.stub().returns(['foo/dir/a.a', 'foo/dir/b.b', 'foo/dir/c.c'])

    try {
      await approval.execute(EXCLUDE_FILE_CONDITIONS_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getPullRequestFiles.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        MISSING_APPROVAL_GROUP_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should ignore approval group requirements if label based condition is met and file based condition is not met', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getIssueLabels = sinon.stub().returns(['goodlabel','badlabel'])
    github.getPullRequestFiles = sinon.stub().returns(['foo/dir/a.a', 'foo/dir/b.b', 'foo/dir/c.c'])

    try {
      await approval.execute(FILE_AND_LABEL_CONDITIONS_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getIssueLabels.callCount).to.equal(1)
      expect(github.getPullRequestFiles.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        SUCCESS_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should ignore approval group requirements if label based condition is not met and file based condition is met', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getIssueLabels = sinon.stub().returns([])
    github.getPullRequestFiles = sinon.stub().returns(['foo/dir/a.a', 'foo/dir/b.b', 'foo/dir/c.foo', 'foo/dir/d.d'])

    try {
      await approval.execute(FILE_AND_LABEL_CONDITIONS_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getIssueLabels.callCount).to.equal(1)
      expect(github.getPullRequestFiles.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        SUCCESS_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })

  it('should apply approval group requirements if label based condition is met and file based condition is met', async(done) => {
    github.getComments = sinon.stub().returns([{
      body: ':+1:',
      user: 'foo',
      id: 1
    }, {
      body: ':+1:',
      user: 'bar',
      id: 2
    }])
    github.getPullRequest = sinon.stub().returns(PR_PAYLOAD.pull_request)
    github.getIssueLabels = sinon.stub().returns(['goodlabel','badlabel'])
    github.getPullRequestFiles = sinon.stub().returns(['foo/dir/a.a', 'foo/dir/b.b', 'foo/dir/c.foo', 'foo/dir/d.d'])

    try {
      await approval.execute(FILE_AND_LABEL_CONDITIONS_CONFIG, EVENTS.ISSUE_COMMENT, ISSUE_PAYLOAD, TOKEN, DB_REPO_ID)

      expect(github.setCommitStatus.callCount).to.equal(2)
      expect(github.getIssueLabels.callCount).to.equal(1)
      expect(github.getPullRequestFiles.callCount).to.equal(1)

      const successStatusCallArgs = github.setCommitStatus.args[1]
      expect(successStatusCallArgs).to.deep.equal([
        'mfellner',
        'hello-world',
        'abcd1234',
        MISSING_APPROVAL_GROUP_STATUS,
        TOKEN
      ])
      done()
    } catch (e) {
      done(e)
    }
  })
})
