# Static variants

Drop-in replacements for components that call server actions. The static build swaps
these over the originals, because a static export has no server to run an action on.

Same props, same look, same behaviour from the reader's side — the difference is where
the state goes. On the server build it goes to PostgreSQL and follows you between
devices. Here it goes to `localStorage` and belongs to one browser, which is the honest
consequence of having no server and is stated where a reader would notice.
