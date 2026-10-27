//author: hdmknkttp
#include<bits/stdc++.h>
using namespace std;
#define int long long
#define ld long double
#define fi first
#define se second
#define pb push_back
typedef pair<int, int> pii;
typedef pair<ld, ld> pdd;
#define arr(T, i) array<T, i>
#define arr2d(T, i, j) array<array<T, j>,i>

const int N = 2e5 + 100;
const int lg = 18;
const int INF = 1e18 + 10;
const int MOD = 1e9 + 7;

int n;
int a[N], par[lg][N], pref[N], cnt[N * 2], answ = 0, maxi = 0;

int getmx(int l, int r)
{
    int res = l;
    for (int i = lg - 1; i >= 0; i--) {
        if (l + (1ll << i) - 1 <= r) {
            res = (a[par[i][l]] > a[res] ? par[i][l] : res);
            l += (1ll << i);
        }
    }
    return res;
}

void divide(int l, int r)
{
    if (l > r) return;
    if (l == r) {
        cnt[pref[l]]++;
        return;
    }
    if (l == r - 1) {
        cnt[pref[l]]++;
        cnt[pref[r]]++;
        if ((max(a[l], a[r]) & answ) == answ) {
            maxi = max(maxi, pref[l - 1] ^ pref[r]);
        }
        return;
    }
    int mid = getmx(l, r);
    if (r - mid > mid - l) {
        divide(l, mid - 1);
        for (int i = l; i < mid; i++) cnt[pref[i]]--;
        divide(mid + 1, r);

        for (int i = mid - 1; i >= l - 1; i--) {
            if (cnt[(answ ^ pref[i])] > 0 && (a[mid] & answ) == answ) maxi = answ;
            if (i == mid - 1) cnt[pref[mid]]++;
        }
        for (int i = mid - 1; i >= l; i--) cnt[pref[i]]++;
    } else {
        divide(mid + 1, r);
        for (int i = mid + 1; i <= r; i++) cnt[pref[i]]--;
        divide(l, mid - 1);

        cnt[pref[mid - 1]]--;
        cnt[pref[l - 1]]++;
        for (int i = mid; i <= r; i++) {
            if (cnt[(answ ^ pref[i])] > 0 && (a[mid] & answ) == answ) maxi = answ;
            if (i == mid) cnt[pref[mid - 1]]++;
        }
        cnt[pref[l - 1]]--;

        for (int i = mid; i <= r; i++) cnt[pref[i]]++;
    }
}

bool check()
{
    maxi = 0;
    for (int j = 1; j <= n; j++) {
        pref[j] = pref[j - 1] ^ (a[j] & answ);
    }

    divide(1, n);
    for (int i = 1; i <= n; i++) {
        cnt[pref[i]] = 0;
    }

    if (maxi == answ) return 1;
    return 0;
}

void solve()
{
    answ = 0;
    int mxtmp = 0, anstmp = 0;
    for (int i = 1; i <= n; i++) {
        mxtmp = max(mxtmp, a[i]);
    }
    for (int i = 1; i <= n; i++) {
        anstmp ^= (a[i] & mxtmp);
    }
    for (int i = n; i >= 1; i--) {
        for (int j = 1; j < lg; j++) {
            int x = par[j - 1][i];
            int y = par[j - 1][min(n, i + (1LL << (j - 1)))];
            if (a[x] > a[y]) par[j][i] = x;
            else par[j][i] = y;
        }
    }
    for (int i = lg - 1; i >= 0; i--) {
        answ += (1LL << i);

        if (check() == 0) {
            answ -= (1LL << i);
        }
    }
    cout << max(answ, anstmp) << "\n";
    for (int i = 1; i <= n; i++) {
        a[i] = 0;
        pref[i] = 0;
    }
}

void read()
{
    cin >> n;
    for (int i = 1; i <= n; i++) {
        cin >> a[i];
        par[0][i] = i;
    }
}

signed main()
{
    ios::sync_with_stdio(0);
    cin.tie(0);

    int t = 1;
    cin >> t;

    while (t--)
    {
        read();
        solve();
    }

    return 0;
}