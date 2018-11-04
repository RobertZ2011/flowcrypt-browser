/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/store.js';
import { Catch, Env, Value } from '../../../js/common/common.js';
import { Xss, Ui } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Settings } from '../../../js/common/settings.js';
import { Api } from '../../../js/common/api.js';

Catch.try(async () => {

  let urlParams = Env.urlParams(['account_email', 'parent_tab_id']);
  let account_email = Env.urlParamRequire.string(urlParams, 'account_email');
  let parent_tab_id = Env.urlParamRequire.string(urlParams, 'parent_tab_id');

  $('.email-address').text(account_email);

  Xss.sanitizeRender('.summary', '<br><br><br><br>Loading from keyserver<br><br>' + Ui.spinner('green'));

  let render_diagnosis = (diagnosis: any, attests_requested: string[]) => {
    for (let email of Object.keys(diagnosis.results)) {
      let result = diagnosis.results[email];
      let note, action, remove, color;
      if (result.pubkey === null) {
        note = 'Missing record. Your contacts will not know you have encryption set up.';
        action = `<div class="button gray2 small action_request_attestation" email="${Xss.htmlEscape(email)}">Submit public key</div>`;
        remove = ` &nbsp; <b class="bad action_remove_alias" email="${Xss.htmlEscape(email)}" title="Remove address from list of send-from addresses.">[x]</b> &nbsp; `;
        color = 'orange';
      } else if (result.match) {
        if (email === account_email && !result.attested) {
          if (attests_requested && attests_requested.length) {
            note = `Submitted. Attestation was requested from ${Xss.htmlEscape(attests_requested.join(', '))} and should process shortly.`;
            action = `<div class="button gray2 small refresh_after_attest_request" email="${Xss.htmlEscape(email)}">Refresh</div>`;
            remove = '';
            color = 'orange';
          } else {
            note = 'Found but not attested.';
            action = `<div class="button gray2 small action_request_attestation" email="${Xss.htmlEscape(email)}">Request Attestation</div>`;
            remove = '';
            color = 'orange';
          }
        } else if (email === account_email && result.attested) {
          note = 'Submitted, can receive encrypted email. Attested by CRYPTUP.';
          action = '';
          remove = '';
          color = 'green';
        } else {
          note = 'Submitted, can receive encrypted email.';
          action = '';
          remove = '';
          color = 'green';
        }
      } else {
        if (email === account_email && !result.attested) {
          note = 'Wrong public key recorded. Your incoming email may be unreadable when encrypted.';
          action = `<div class="button gray2 small action_request_attestation" email="${Xss.htmlEscape(email)}">Request Attestation</div>`;
          remove = '';
          color = 'red';
        } else if (email === account_email && result.attested && attests_requested && attests_requested.length) {
          note = 'Re-Attestation requested. This should process shortly.';
          action = `<div class="button gray2 small refresh_after_attest_request" email="${Xss.htmlEscape(email)}">Refresh</div>`;
          remove = '';
          color = 'orange';
        } else if (email === account_email && result.attested) {
          note = 'Wrong public key recorded. Your incoming email may be unreadable when encrypted.';
          action = `<div class="button gray2 small request_replacement" email="${Xss.htmlEscape(email)}">Request Replacement Attestation</div>`;
          remove = '';
          color = 'red';
        } else {
          note = 'Wrong public key recorded. Your incoming email may be unreadable when encrypted.';
          action = '';
          remove = '';
          color = 'red';
        }
      }
      Xss.sanitizeAppend('#content', `<div class="line left">${Xss.htmlEscape(email)}: <span class="${color}">${note}</span> ${remove} ${action}</div>`);
    }

    $('.action_request_attestation').click(Ui.event.prevent('double', async self => {
      Xss.sanitizeRender(self, Ui.spinner('white'));
      await action_submit_or_request_attestation($(self).attr('email')!);
    }));
    $('.action_remove_alias').click(Ui.event.prevent('double', async self => {
      let {addresses} = await Store.getAccount(account_email, ['addresses']);
      await Store.set(account_email, {'addresses': Value.arr.without_value(addresses || [], $(self).attr('email')!)});
      window.location.reload();
    }));
    $('.request_replacement').click(Ui.event.prevent('double', self => {
      Xss.sanitizeRender(self, Ui.spinner('white'));
      Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/settings/modules/request_replacement.htm');
    }));
    $('.refresh_after_attest_request').click(Ui.event.prevent('double', async self => {
      Xss.sanitizeRender(self, 'Updating..' + Ui.spinner('white'));
      BrowserMsg.send(null, 'attest_requested', {account_email});
      await Ui.time.sleep(30000);
      window.location.reload();
    }));
    Xss.sanitizeAppend('#content', '<div class="line"><a href="#" class="action_fetch_aliases">Missing email address? Refresh list</a></div>').find('.action_fetch_aliases').click(Ui.event.prevent('parallel', async (self, done) => {
      Xss.sanitizeRender(self, Ui.spinner('green'));
      try {
        let addresses = await Settings.fetch_account_aliases_from_gmail(account_email);
        await Store.set(account_email, { addresses: Value.arr.unique(addresses.concat(account_email)) });
      } catch(e) {
        if(Api.err.isNetErr(e)) {
          alert('Need internet connection to finish. Please click the button again to retry.');
        } else if(parent_tab_id && Api.err.isAuthPopupNeeded(e)) {
          BrowserMsg.send(parent_tab_id, 'notification_show_auth_popup_needed', {account_email});
          alert('Account needs to be re-connected first. Please try later.');
        } else {
          Catch.handle_exception(e);
          alert(`Error happened: ${e.message}`);
        }
      }
      window.location.reload();
      done();
    }));
  };

  let action_submit_or_request_attestation = async (email: string) => {
    let [primary_ki] = await Store.keysGet(account_email, ['primary']);
    Settings.abort_and_render_error_if_keyinfo_empty(primary_ki);
    try {
      if (email === account_email) { // request attestation
        await Settings.save_attest_request(account_email, 'CRYPTUP');
        await Api.attester.initialLegacySubmit(email, primary_ki.public, true);
      } else { // submit only
        await Api.attester.initialLegacySubmit(email, primary_ki.public, false);
      }
    } catch (e) {
      Catch.handle_exception(e);
    } finally {
      window.location.reload();
    }
  };

  let storage = await Store.getAccount(account_email, ['attests_requested', 'addresses']);
  try {
    let diagnosis = await Api.attester.diagnoseKeyserverPubkeys(account_email);
    $('.summary').text('');
    render_diagnosis(diagnosis, storage.attests_requested || []);
  } catch (e) {
    if (Api.err.isNetErr(e)) {
      Xss.sanitizeRender('.summary', `Failed to load due to internet connection. ${Ui.retryLink()}`);
    } else {
      Xss.sanitizeRender('.summary', `Failed to load. ${Ui.retryLink()}`);
      Catch.handle_exception(e);
    }
  }

})();